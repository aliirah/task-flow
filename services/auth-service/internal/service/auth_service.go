package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/aliirah/task-flow/services/auth-service/internal/models"
	userpb "github.com/aliirah/task-flow/shared/proto/user/v1"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"gorm.io/gorm"
)

type Config struct {
	JWTSecret       []byte
	AccessTokenTTL  time.Duration
	RefreshTokenTTL time.Duration
}

var (
	ErrEmailExists         = errors.New("email already registered")
	ErrInvalidCredentials  = errors.New("invalid credentials")
	ErrAccountDisabled     = errors.New("account disabled")
	ErrRefreshTokenExpired = errors.New("refresh token expired")
	ErrRefreshTokenInvalid = errors.New("invalid refresh token")
	ErrTokenInvalid        = errors.New("invalid token")
	ErrTokenExpired        = errors.New("token expired")
	ErrUserNotFound        = errors.New("user not found")
)

type AuthService struct {
	db         *gorm.DB
	cfg        Config
	userClient userpb.UserServiceClient
}

func NewAuthService(db *gorm.DB, cfg Config, userClient userpb.UserServiceClient) *AuthService {
	if len(cfg.JWTSecret) == 0 {
		cfg.JWTSecret = []byte("development-secret")
	}
	if cfg.AccessTokenTTL <= 0 {
		cfg.AccessTokenTTL = 15 * time.Minute
	}
	if cfg.RefreshTokenTTL <= 0 {
		cfg.RefreshTokenTTL = 24 * time.Hour
	}
	return &AuthService{
		db:         db,
		cfg:        cfg,
		userClient: userClient,
	}
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

type TokenPair struct {
	AccessToken  string
	RefreshToken string
	ExpiresAt    time.Time
}

type UserProfile struct {
	ID        string
	Email     string
	FirstName string
	LastName  string
	Roles     []string
	Status    string
	UserType  string
}

type TokenBundle struct {
	TokenPair
	Profile UserProfile
}

type jwtClaims struct {
	Email    string   `json:"email"`
	Roles    []string `json:"roles"`
	UserType string   `json:"user_type"`
	jwt.RegisteredClaims
}

func (s *AuthService) SignUp(ctx context.Context, input SignUpInput) (TokenBundle, error) {
	var existing models.AuthUser
	if err := s.db.WithContext(ctx).Where("email = ?", input.Email).First(&existing).Error; err == nil {
		return TokenBundle{}, ErrEmailExists
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return TokenBundle{}, err
	}

	if input.UserType == "" {
		input.UserType = "user"
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return TokenBundle{}, err
	}

	user := models.AuthUser{
		Email:        input.Email,
		PasswordHash: string(hash),
		Status:       "active",
		UserType:     input.UserType,
	}

	if err := s.db.WithContext(ctx).Create(&user).Error; err != nil {
		return TokenBundle{}, err
	}

	profile, err := s.ensureUserProfile(ctx, user, input)
	if err != nil {
		s.db.WithContext(ctx).Delete(&user)
		return TokenBundle{}, err
	}

	tokenPair, err := s.issueTokens(ctx, user.ID, profile)
	if err != nil {
		s.db.WithContext(ctx).Delete(&user)
		return TokenBundle{}, err
	}

	return TokenBundle{TokenPair: tokenPair, Profile: profile}, nil
}

func (s *AuthService) Login(ctx context.Context, input LoginInput) (TokenBundle, error) {
	var user models.AuthUser
	if err := s.db.WithContext(ctx).Where("email = ?", input.Email).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return TokenBundle{}, ErrInvalidCredentials
		}
		return TokenBundle{}, err
	}

	if user.Status != "active" {
		return TokenBundle{}, ErrAccountDisabled
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)); err != nil {
		return TokenBundle{}, ErrInvalidCredentials
	}

	profile, err := s.fetchUserProfile(ctx, user)
	if err != nil {
		return TokenBundle{}, err
	}

	tokenPair, err := s.issueTokens(ctx, user.ID, profile)
	if err != nil {
		return TokenBundle{}, err
	}

	now := time.Now().UTC()
	_ = s.db.WithContext(ctx).Model(&user).Update("last_login_at", &now)

	return TokenBundle{TokenPair: tokenPair, Profile: profile}, nil
}

func (s *AuthService) Refresh(ctx context.Context, refreshToken string) (TokenBundle, error) {
	if refreshToken == "" {
		return TokenBundle{}, errors.New("missing refresh token")
	}

	hash := hashToken(refreshToken)
	var stored models.RefreshToken
	if err := s.db.WithContext(ctx).
		Where("token_hash = ? AND revoked_at IS NULL", hash).
		First(&stored).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return TokenBundle{}, ErrRefreshTokenInvalid
		}
		return TokenBundle{}, err
	}

	if time.Now().UTC().After(stored.ExpiresAt) {
		s.revokeRefreshToken(ctx, stored.ID)
		return TokenBundle{}, ErrRefreshTokenExpired
	}

	user, err := s.loadAuthUser(ctx, stored.UserID)
	if err != nil {
		return TokenBundle{}, err
	}

	profile, err := s.fetchUserProfile(ctx, user)
	if err != nil {
		return TokenBundle{}, err
	}

	if err := s.revokeRefreshToken(ctx, stored.ID); err != nil {
		return TokenBundle{}, err
	}

	tokenPair, err := s.issueTokens(ctx, user.ID, profile)
	if err != nil {
		return TokenBundle{}, err
	}

	return TokenBundle{TokenPair: tokenPair, Profile: profile}, nil
}

func (s *AuthService) Logout(ctx context.Context, refreshToken string) error {
	if refreshToken == "" {
		return errors.New("missing refresh token")
	}
	hash := hashToken(refreshToken)
	return s.db.WithContext(ctx).
		Model(&models.RefreshToken{}).
		Where("token_hash = ?", hash).
		Update("revoked_at", time.Now().UTC()).Error
}

func (s *AuthService) Validate(ctx context.Context, accessToken string) (UserProfile, time.Time, error) {
	if accessToken == "" {
		return UserProfile{}, time.Time{}, ErrTokenInvalid
	}

	claims := &jwtClaims{}
	parsed, err := jwt.ParseWithClaims(accessToken, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return s.cfg.JWTSecret, nil
	})
	if err != nil || !parsed.Valid {
		return UserProfile{}, time.Time{}, ErrTokenInvalid
	}

	userID, err := uuid.Parse(claims.Subject)
	if err != nil {
		return UserProfile{}, time.Time{}, ErrTokenInvalid
	}

	user, err := s.loadAuthUser(ctx, userID)
	if err != nil {
		return UserProfile{}, time.Time{}, err
	}

	profile, err := s.fetchUserProfile(ctx, user)
	if err != nil {
		return UserProfile{}, time.Time{}, err
	}

	expiry := claims.ExpiresAt.Time
	if time.Now().After(expiry) {
		return UserProfile{}, time.Time{}, ErrTokenExpired
	}

	return profile, expiry, nil
}

func (s *AuthService) issueTokens(ctx context.Context, userID uuid.UUID, profile UserProfile) (TokenPair, error) {
	now := time.Now().UTC()
	claims := &jwtClaims{
		Email:    profile.Email,
		Roles:    profile.Roles,
		UserType: profile.UserType,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.cfg.AccessTokenTTL)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	accessToken, err := token.SignedString(s.cfg.JWTSecret)
	if err != nil {
		return TokenPair{}, err
	}

	refreshToken := uuid.NewString()
	refreshRecord := models.RefreshToken{
		UserID:    userID,
		TokenHash: hashToken(refreshToken),
		ExpiresAt: now.Add(s.cfg.RefreshTokenTTL),
	}
	if err := s.db.WithContext(ctx).Create(&refreshRecord).Error; err != nil {
		return TokenPair{}, err
	}

	return TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresAt:    claims.ExpiresAt.Time,
	}, nil
}

func (s *AuthService) ensureUserProfile(ctx context.Context, user models.AuthUser, input SignUpInput) (UserProfile, error) {
	if s.userClient == nil {
		return UserProfile{
			ID:        user.ID.String(),
			Email:     user.Email,
			FirstName: input.FirstName,
			LastName:  input.LastName,
			Status:    user.Status,
			UserType:  user.UserType,
		}, nil
	}

	roles := []string{}
	if input.UserType != "" {
		roles = append(roles, input.UserType)
	}

	req := &userpb.CreateUserRequest{
		Id:        user.ID.String(),
		Email:     user.Email,
		Password:  "",
		FirstName: input.FirstName,
		LastName:  input.LastName,
		UserType:  user.UserType,
		Roles:     roles,
	}

	profile, err := s.userClient.CreateUser(ctx, req)
	if err != nil {
		return UserProfile{}, mapUserServiceError(err)
	}

	return mapUserProfile(profile), nil
}

func (s *AuthService) fetchUserProfile(ctx context.Context, user models.AuthUser) (UserProfile, error) {
	if s.userClient == nil {
		return UserProfile{
			ID:       user.ID.String(),
			Email:    user.Email,
			Status:   user.Status,
			UserType: user.UserType,
		}, nil
	}

	profile, err := s.userClient.GetUser(ctx, &userpb.GetUserRequest{Id: user.ID.String()})
	if err != nil {
		// If profile missing, fall back to basic details.
		if status.Code(err) == codes.NotFound {
			return UserProfile{
				ID:       user.ID.String(),
				Email:    user.Email,
				Status:   user.Status,
				UserType: user.UserType,
			}, nil
		}
		return UserProfile{}, mapUserServiceError(err)
	}

	return mapUserProfile(profile), nil
}

func (s *AuthService) loadAuthUser(ctx context.Context, id uuid.UUID) (models.AuthUser, error) {
	var user models.AuthUser
	if err := s.db.WithContext(ctx).First(&user, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return models.AuthUser{}, errors.New("user not found")
		}
		return models.AuthUser{}, err
	}
	if user.Status != "active" {
		return models.AuthUser{}, errors.New("account disabled")
	}
	return user, nil
}

func (s *AuthService) revokeRefreshToken(ctx context.Context, id uuid.UUID) error {
	return s.db.WithContext(ctx).
		Model(&models.RefreshToken{}).
		Where("id = ?", id).
		Update("revoked_at", time.Now().UTC()).Error
}

func mapUserProfile(u *userpb.User) UserProfile {
	if u == nil {
		return UserProfile{}
	}
	return UserProfile{
		ID:        u.GetId(),
		Email:     u.GetEmail(),
		FirstName: u.GetFirstName(),
		LastName:  u.GetLastName(),
		Roles:     append([]string{}, u.GetRoles()...),
		Status:    u.GetStatus(),
		UserType:  u.GetUserType(),
	}
}

func mapUserServiceError(err error) error {
	st, ok := status.FromError(err)
	if !ok {
		return err
	}
	switch st.Code() {
	case codes.InvalidArgument:
		return errors.New(st.Message())
	case codes.NotFound:
		return errors.New("user profile not found")
	case codes.AlreadyExists:
		return ErrEmailExists
	case codes.Internal:
		return errors.New("user service error")
	default:
		return err
	}
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
