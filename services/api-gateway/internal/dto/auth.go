package dto

import (
	"strings"

	"github.com/aliirah/task-flow/services/api-gateway/internal/service"
)

type SignUpPayload struct {
	Email     string `json:"email" validate:"required,email"`
	Password  string `json:"password" validate:"required,min=8"`
	FirstName string `json:"firstName" validate:"required,min=2"`
	LastName  string `json:"lastName" validate:"required,min=2"`
	UserType  string `json:"userType" validate:"omitempty,oneof=user admin"`
}

func (p SignUpPayload) Build() service.AuthSignUpRequest {
	userType := strings.TrimSpace(p.UserType)
	if userType == "" {
		userType = "user"
	}
	return service.AuthSignUpRequest{
		Email:     strings.TrimSpace(p.Email),
		Password:  p.Password,
		FirstName: strings.TrimSpace(p.FirstName),
		LastName:  strings.TrimSpace(p.LastName),
		UserType:  userType,
	}
}

type LoginPayload struct {
	Identifier string `json:"identifier" validate:"required"`
	Password   string `json:"password" validate:"required,min=8"`
}

func (p LoginPayload) Build() service.AuthLoginRequest {
	return service.AuthLoginRequest{
		Identifier: strings.TrimSpace(p.Identifier),
		Password:   p.Password,
	}
}

type RefreshPayload struct {
	RefreshToken string `json:"refreshToken" validate:"required"`
}

func (p RefreshPayload) Build() service.AuthRefreshRequest {
	return service.AuthRefreshRequest{RefreshToken: strings.TrimSpace(p.RefreshToken)}
}

type LogoutPayload struct {
	RefreshToken string `json:"refreshToken" validate:"required"`
}

func (p LogoutPayload) Build() service.AuthLogoutRequest {
	return service.AuthLogoutRequest{RefreshToken: strings.TrimSpace(p.RefreshToken)}
}
