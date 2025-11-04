package service

import (
	"context"
	"errors"
	"strings"

	"github.com/aliirah/task-flow/services/organization-service/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrOrganizationNotFound = errors.New("organization not found")
)

type Service struct {
	db *gorm.DB
}

func New(db *gorm.DB) *Service {
	return &Service{db: db}
}

type CreateOrganizationInput struct {
	Name        string
	Description string
	OwnerID     uuid.UUID
}

func (s *Service) CreateOrganization(ctx context.Context, input CreateOrganizationInput) (*models.Organization, error) {
	org := &models.Organization{
		Name:        strings.TrimSpace(input.Name),
		Description: strings.TrimSpace(input.Description),
		OwnerID:     input.OwnerID,
	}

	if err := s.db.WithContext(ctx).Create(org).Error; err != nil {
		return nil, err
	}

	if input.OwnerID != uuid.Nil {
		member := models.OrganizationMember{
			OrganizationID: org.ID,
			UserID:         input.OwnerID,
			Role:           "owner",
			Status:         "active",
		}
		_ = s.db.WithContext(ctx).Where("organization_id = ? AND user_id = ?", org.ID, input.OwnerID).FirstOrCreate(&member).Error
	}

	return org, nil
}

func (s *Service) GetOrganization(ctx context.Context, id uuid.UUID) (*models.Organization, error) {
	var org models.Organization
	if err := s.db.WithContext(ctx).First(&org, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrOrganizationNotFound
		}
		return nil, err
	}
	return &org, nil
}

type ListOrganizationsParams struct {
	Query string
	Page  int
	Limit int
}

func (s *Service) ListOrganizations(ctx context.Context, params ListOrganizationsParams) ([]models.Organization, error) {
	if params.Page <= 0 {
		params.Page = 1
	}
	if params.Limit <= 0 {
		params.Limit = 20
	}

	var orgs []models.Organization
	query := s.db.WithContext(ctx).Model(&models.Organization{}).Order("created_at DESC")
	if params.Query != "" {
		q := "%" + strings.ToLower(params.Query) + "%"
		query = query.Where("LOWER(name) LIKE ?", q)
	}

	offset := (params.Page - 1) * params.Limit
	if err := query.Offset(offset).Limit(params.Limit).Find(&orgs).Error; err != nil {
		return nil, err
	}
	return orgs, nil
}

type UpdateOrganizationInput struct {
	Name        *string
	Description *string
}

func (s *Service) UpdateOrganization(ctx context.Context, id uuid.UUID, input UpdateOrganizationInput) (*models.Organization, error) {
	org, err := s.GetOrganization(ctx, id)
	if err != nil {
		return nil, err
	}

	updates := map[string]interface{}{}
	if input.Name != nil {
		updates["name"] = strings.TrimSpace(*input.Name)
	}
	if input.Description != nil {
		updates["description"] = strings.TrimSpace(*input.Description)
	}

	if len(updates) > 0 {
		if err := s.db.WithContext(ctx).Model(org).Updates(updates).Error; err != nil {
			return nil, err
		}
	}

	return org, nil
}

func (s *Service) DeleteOrganization(ctx context.Context, id uuid.UUID) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Delete(&models.OrganizationMember{}, "organization_id = ?", id).Error; err != nil {
			return err
		}
		if err := tx.Delete(&models.Organization{}, "id = ?", id).Error; err != nil {
			return err
		}
		return nil
	})
}

type AddMemberInput struct {
	OrganizationID uuid.UUID
	UserID         uuid.UUID
	Role           string
}

func (s *Service) AddMember(ctx context.Context, input AddMemberInput) (*models.OrganizationMember, error) {
	member := models.OrganizationMember{
		OrganizationID: input.OrganizationID,
		UserID:         input.UserID,
		Role:           strings.TrimSpace(input.Role),
		Status:         "active",
	}

	err := s.db.WithContext(ctx).FirstOrCreate(&member, models.OrganizationMember{
		OrganizationID: input.OrganizationID,
		UserID:         input.UserID,
	}).Error
	if err != nil {
		return nil, err
	}

	return &member, nil
}

func (s *Service) RemoveMember(ctx context.Context, organizationID, userID uuid.UUID) error {
	return s.db.WithContext(ctx).
		Delete(&models.OrganizationMember{}, "organization_id = ? AND user_id = ?", organizationID, userID).Error
}

type ListMembersParams struct {
	OrganizationID uuid.UUID
	Page           int
	Limit          int
}

func (s *Service) ListMembers(ctx context.Context, params ListMembersParams) ([]models.OrganizationMember, error) {
	if params.Page <= 0 {
		params.Page = 1
	}
	if params.Limit <= 0 {
		params.Limit = 20
	}
	offset := (params.Page - 1) * params.Limit

	var members []models.OrganizationMember
	if err := s.db.WithContext(ctx).
		Where("organization_id = ?", params.OrganizationID).
		Order("created_at DESC").
		Offset(offset).
		Limit(params.Limit).
		Find(&members).Error; err != nil {
		return nil, err
	}
	return members, nil
}

func (s *Service) ListUserMemberships(ctx context.Context, userID uuid.UUID) ([]models.OrganizationMember, error) {
	var memberships []models.OrganizationMember
	if err := s.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Find(&memberships).Error; err != nil {
		return nil, err
	}
	return memberships, nil
}

func (s *Service) ListOrganizationsByIDs(ctx context.Context, ids []uuid.UUID) ([]models.Organization, error) {
	if len(ids) == 0 {
		return []models.Organization{}, nil
	}
	var orgs []models.Organization
	if err := s.db.WithContext(ctx).
		Where("id IN ?", ids).
		Find(&orgs).Error; err != nil {
		return nil, err
	}
	return orgs, nil
}
