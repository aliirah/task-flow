package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"time"

	"github.com/aliirah/task-flow/services/auth-service/internal/models"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AuthService struct {
	db *gorm.DB
}

func NewAuthService(db *gorm.DB) *AuthService {
	return &AuthService{db: db}
}

type TokenPair struct {
	AccessToken  string
	RefreshToken string
	ExpiresAt    time.Time
}

type SignUpInput struct {
	Email     string
	Password  string
	FirstName string
	LastName  string
	UserType  string
}

type LoginInput struct {
	Email    string
	Password string
}

func (s *AuthService) SignUp(ctx context.Context, input SignUpInput) (models.AuthUser, TokenPair, error) {
	var existing models.AuthUser
	if err := s.db.WithContext(ctx).Where("email = ?", input.Email).First(&existing).Error; err == nil {
		return models.AuthUser{}, TokenPair{}, errors.New("email already registered")
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return models.AuthUser{}, TokenPair{}, err
	}

	if input.UserType == "" {
		input.UserType = "user"
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return models.AuthUser{}, TokenPair{}, err
	}

	user := models.AuthUser{
		Email:        input.Email,
		PasswordHash: string(hash),
		Status:       "active",
		UserType:     input.UserType,
	}

	if err := s.db.WithContext(ctx).Create(&user).Error; err != nil {
		return models.AuthUser{}, TokenPair{}, err
	}

	tokens, err := s.issueTokens(ctx, user.ID)
	if err != nil {
		return models.AuthUser{}, TokenPair{}, err
	}

	return user, tokens, nil
}

func (s *AuthService) Login(ctx context.Context, input LoginInput) (models.AuthUser, TokenPair, error) {
	var user models.AuthUser
	if err := s.db.WithContext(ctx).Where("email = ?", input.Email).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return models.AuthUser{}, TokenPair{}, errors.New("invalid credentials")
		}
		return models.AuthUser{}, TokenPair{}, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)); err != nil {
		return models.AuthUser{}, TokenPair{}, errors.New("invalid credentials")
	}

	tokens, err := s.issueTokens(ctx, user.ID)
	if err != nil {
		return models.AuthUser{}, TokenPair{}, err
	}

	now := time.Now().UTC()
	s.db.WithContext(ctx).Model(&user).Update("last_login_at", &now)

	return user, tokens, nil
}

func (s *AuthService) Refresh(ctx context.Context, refreshToken string) (TokenPair, error) {
	hash := hashToken(refreshToken)

	var stored models.RefreshToken
	if err := s.db.WithContext(ctx).Where("token_hash = ? AND revoked_at IS NULL", hash).
		First(&stored).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return TokenPair{}, errors.New("invalid refresh token")
		}
		return TokenPair{}, err
	}

	if stored.ExpiresAt.Before(time.Now().UTC()) {
		return TokenPair{}, errors.New("refresh token expired")
	}

	return s.issueTokens(ctx, stored.UserID)
}

func (s *AuthService) Logout(ctx context.Context, refreshToken string) error {
	hash := hashToken(refreshToken)
	return s.db.WithContext(ctx).
		Model(&models.RefreshToken{}).
		Where("token_hash = ?", hash).
		Update("revoked_at", time.Now().UTC()).Error
}

func (s *AuthService) issueTokens(ctx context.Context, userID uuid.UUID) (TokenPair, error) {
	accessToken := uuid.NewString()
	refreshToken := uuid.NewString()

	expiresAt := time.Now().Add(15 * time.Minute).UTC()

	record := models.RefreshToken{
		UserID:    userID,
		TokenHash: hashToken(refreshToken),
		ExpiresAt: time.Now().Add(24 * time.Hour).UTC(),
	}
	if err := s.db.WithContext(ctx).Create(&record).Error; err != nil {
		return TokenPair{}, err
	}

	return TokenPair{AccessToken: accessToken, RefreshToken: refreshToken, ExpiresAt: expiresAt}, nil
}

func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}
