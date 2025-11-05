package dto

import (
	"strings"

	organizationpb "github.com/aliirah/task-flow/shared/proto/organization/v1"
)

type OrganizationCreatePayload struct {
	Name        string `json:"name" validate:"required,min=2"`
	Description string `json:"description" validate:"omitempty,max=1024"`
}

func (p OrganizationCreatePayload) Build(ownerID string) *organizationpb.CreateOrganizationRequest {
	return &organizationpb.CreateOrganizationRequest{
		Name:        strings.TrimSpace(p.Name),
		Description: strings.TrimSpace(p.Description),
		OwnerId:     ownerID,
	}
}

type OrganizationUpdatePayload struct {
	Name        *string `json:"name" validate:"omitempty,min=2"`
	Description *string `json:"description" validate:"omitempty,max=1024"`
}

func (p OrganizationUpdatePayload) Build(id string) *organizationpb.UpdateOrganizationRequest {
	req := &organizationpb.UpdateOrganizationRequest{Id: id}
	if p.Name != nil {
		req.Name = strings.TrimSpace(*p.Name)
	}
	if p.Description != nil {
		req.Description = strings.TrimSpace(*p.Description)
	}
	return req
}

type OrganizationAddMemberPayload struct {
	UserID string `json:"userId" validate:"required,uuid4"`
	Role   string `json:"role" validate:"omitempty,oneof=owner admin member"`
}

func (p OrganizationAddMemberPayload) Build(orgID string) *organizationpb.AddMemberRequest {
	return &organizationpb.AddMemberRequest{
		OrganizationId: orgID,
		UserId:         strings.TrimSpace(p.UserID),
		Role:           strings.TrimSpace(p.Role),
	}
}
