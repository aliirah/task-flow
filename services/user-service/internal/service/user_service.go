package service

import (
	"context"
	"errors"

	"github.com/aliirah/task-flow/services/user-service/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type UserService struct {
	db *gorm.DB
}

func NewUserService(db *gorm.DB) *UserService {
	return &UserService{db: db}
}

type CreateUserInput struct {
	ID        uuid.UUID
	Email     string
	FirstName string
	LastName  string
	Status    string
	UserType  string
	Roles     []string
}

type UpdateUserInput struct {
	FirstName *string
	LastName  *string
	Status    *string
	UserType  *string
	Roles     *[]string
}

func (s *UserService) Create(ctx context.Context, input CreateUserInput) (*models.User, error) {
	user := models.User{
		ID:        input.ID,
		Email:     input.Email,
		FirstName: input.FirstName,
		LastName:  input.LastName,
		Status:    defaultString(input.Status, "active"),
		UserType:  defaultString(input.UserType, "user"),
	}

	if err := s.db.WithContext(ctx).Create(&user).Error; err != nil {
		return nil, err
	}

	if len(input.Roles) > 0 {
		if err := s.assignRoles(ctx, &user, input.Roles); err != nil {
			return nil, err
		}
	}

	return &user, nil
}

func (s *UserService) Get(ctx context.Context, id uuid.UUID) (*models.User, error) {
	var user models.User
	if err := s.db.WithContext(ctx).Preload("Roles").First(&user, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *UserService) List(ctx context.Context) ([]models.User, error) {
	var users []models.User
	if err := s.db.WithContext(ctx).Preload("Roles").Find(&users).Error; err != nil {
		return nil, err
	}
	return users, nil
}

func (s *UserService) ListByIDs(ctx context.Context, ids []uuid.UUID) ([]models.User, error) {
	if len(ids) == 0 {
		return []models.User{}, nil
	}
	var users []models.User
	if err := s.db.WithContext(ctx).Preload("Roles").Find(&users, "id IN ?", ids).Error; err != nil {
		return nil, err
	}
	return users, nil
}

func (s *UserService) Update(ctx context.Context, id uuid.UUID, input UpdateUserInput) (*models.User, error) {
	user, err := s.Get(ctx, id)
	if err != nil {
		return nil, err
	}

	updates := map[string]interface{}{}
	if input.FirstName != nil {
		updates["first_name"] = *input.FirstName
	}
	if input.LastName != nil {
		updates["last_name"] = *input.LastName
	}
	if input.Status != nil {
		updates["status"] = *input.Status
	}
	if input.UserType != nil {
		updates["user_type"] = *input.UserType
	}

	if len(updates) > 0 {
		if err := s.db.WithContext(ctx).Model(user).Updates(updates).Error; err != nil {
			return nil, err
		}
	}

	if input.Roles != nil {
		if err := s.assignRoles(ctx, user, *input.Roles); err != nil {
			return nil, err
		}
	}

	return user, nil
}

func (s *UserService) Delete(ctx context.Context, id uuid.UUID) error {
	return s.db.WithContext(ctx).Delete(&models.User{}, "id = ?", id).Error
}

func (s *UserService) assignRoles(ctx context.Context, user *models.User, roleNames []string) error {
	if len(roleNames) == 0 {
		return nil
	}

	var roles []models.Role
	if err := s.db.WithContext(ctx).Where("name IN ?", roleNames).Find(&roles).Error; err != nil {
		return err
	}

	if len(roles) != len(roleNames) {
		return errors.New("one or more roles not found")
	}

	return s.db.WithContext(ctx).Model(user).Association("Roles").Replace(roles)
}

func defaultString(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}
