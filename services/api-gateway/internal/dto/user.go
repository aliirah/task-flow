package dto

import (
	"strings"

	"github.com/aliirah/task-flow/services/api-gateway/internal/service"
)

type UserCreatePayload struct {
	Email     string   `json:"email" validate:"required,email"`
	Password  string   `json:"password" validate:"required,min=8"`
	FirstName string   `json:"firstName" validate:"required,min=2"`
	LastName  string   `json:"lastName" validate:"required,min=2"`
	UserType  string   `json:"userType" validate:"required,oneof=user admin"`
	Roles     []string `json:"roles" validate:"omitempty,dive,required"`
}

func (p UserCreatePayload) Build() *service.UserCreateInput {
	return &service.UserCreateInput{
		Email:     strings.TrimSpace(p.Email),
		Password:  p.Password,
		FirstName: strings.TrimSpace(p.FirstName),
		LastName:  strings.TrimSpace(p.LastName),
		UserType:  strings.TrimSpace(p.UserType),
		Roles:     p.Roles,
	}
}

type UserUpdatePayload struct {
	FirstName *string   `json:"firstName" validate:"omitempty,min=2"`
	LastName  *string   `json:"lastName" validate:"omitempty,min=2"`
	Roles     *[]string `json:"roles" validate:"omitempty,dive,required"`
	Status    *string   `json:"status" validate:"omitempty,oneof=active inactive suspended"`
	UserType  *string   `json:"userType" validate:"omitempty,oneof=user admin"`
}

func (p UserUpdatePayload) Build() *service.UserUpdateInput {
	return &service.UserUpdateInput{
		FirstName: trimOptional(p.FirstName),
		LastName:  trimOptional(p.LastName),
		Roles:     p.Roles,
		Status:    trimOptional(p.Status),
		UserType:  trimOptional(p.UserType),
	}
}

type ProfilePayload struct {
	FirstName *string `json:"firstName" validate:"omitempty,min=2"`
	LastName  *string `json:"lastName" validate:"omitempty,min=2"`
}

func (p ProfilePayload) Build() *service.ProfileUpdateInput {
	return &service.ProfileUpdateInput{
		FirstName: trimOptional(p.FirstName),
		LastName:  trimOptional(p.LastName),
	}
}

func trimOptional(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}
