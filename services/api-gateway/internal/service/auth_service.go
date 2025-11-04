package service

import (
	"context"
	"errors"

	authpb "github.com/aliirah/task-flow/shared/proto/auth/v1"
)

type AuthSignUpRequest = authpb.SignUpRequest
type AuthLoginRequest = authpb.LoginRequest
type AuthRefreshRequest = authpb.RefreshRequest
type AuthLogoutRequest = authpb.LogoutRequest
type AuthTokenResponse = authpb.TokenResponse
type AuthValidateRequest = authpb.ValidateTokenRequest
type AuthValidateResponse = authpb.ValidateTokenResponse

type AuthService interface {
	SignUp(ctx context.Context, req *AuthSignUpRequest) (*AuthTokenResponse, error)
	Login(ctx context.Context, req *AuthLoginRequest) (*AuthTokenResponse, error)
	Refresh(ctx context.Context, req *AuthRefreshRequest) (*AuthTokenResponse, error)
	Logout(ctx context.Context, req *AuthLogoutRequest) error
	Validate(ctx context.Context, req *AuthValidateRequest) (*AuthValidateResponse, error)
}

func NewAuthService(client authpb.AuthServiceClient) AuthService {
	return &authService{client: client}
}

type authService struct {
	client authpb.AuthServiceClient
}

func (s *authService) Login(ctx context.Context, req *AuthLoginRequest) (*AuthTokenResponse, error) {
	if s.client == nil {
		return nil, errors.New("auth service client not configured")
	}
	return s.client.Login(ctx, req)
}

func (s *authService) SignUp(ctx context.Context, req *AuthSignUpRequest) (*AuthTokenResponse, error) {
	if s.client == nil {
		return nil, errors.New("auth service client not configured")
	}
	return s.client.SignUp(ctx, req)
}

func (s *authService) Refresh(ctx context.Context, req *AuthRefreshRequest) (*AuthTokenResponse, error) {
	if s.client == nil {
		return nil, errors.New("auth service client not configured")
	}
	return s.client.Refresh(ctx, req)
}

func (s *authService) Logout(ctx context.Context, req *AuthLogoutRequest) error {
	if s.client == nil {
		return errors.New("auth service client not configured")
	}
	_, err := s.client.Logout(ctx, req)
	return err
}

func (s *authService) Validate(ctx context.Context, req *AuthValidateRequest) (*AuthValidateResponse, error) {
	if s.client == nil {
		return nil, errors.New("auth service client not configured")
	}
	return s.client.ValidateToken(ctx, req)
}
