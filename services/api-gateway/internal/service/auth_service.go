package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

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
	BuildTokenPayload(resp *AuthTokenResponse) (gin.H, error)
	ExtractToken(c *gin.Context) string
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

func (s *authService) BuildTokenPayload(resp *AuthTokenResponse) (gin.H, error) {
	if resp == nil {
		return nil, errors.New("auth service returned empty response")
	}

	payload := gin.H{
		"accessToken":  resp.GetAccessToken(),
		"refreshToken": resp.GetRefreshToken(),
	}

	if expires := resp.GetExpiresAt(); expires != nil {
		payload["expiresAt"] = expires.AsTime().UTC().Format(time.RFC3339)
	}

	if user := resp.GetUser(); user != nil {
		payload["user"] = gin.H{
			"id":        user.GetId(),
			"email":     user.GetEmail(),
			"firstName": user.GetFirstName(),
			"lastName":  user.GetLastName(),
			"roles":     user.GetRoles(),
			"status":    user.GetStatus(),
			"userType":  user.GetUserType(),
		}
	}

	return payload, nil
}

func (s *authService) ExtractToken(c *gin.Context) string {
	if c == nil {
		return ""
	}
	if token := c.Query("token"); token != "" {
		return token
	}
	auth := c.GetHeader("Authorization")
	if strings.HasPrefix(auth, "Bearer ") {
		return strings.TrimSpace(strings.TrimPrefix(auth, "Bearer "))
	}
	return ""
}
