package handler

import (
	"context"
	"errors"

	"github.com/aliirah/task-flow/services/auth-service/internal/service"
	authpb "github.com/aliirah/task-flow/shared/proto/auth/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	emptypb "google.golang.org/protobuf/types/known/emptypb"
	timestamppb "google.golang.org/protobuf/types/known/timestamppb"
)

type AuthHandler struct {
	authpb.UnimplementedAuthServiceServer
	svc *service.AuthService
}

func NewAuthHandler(svc *service.AuthService) *AuthHandler {
	return &AuthHandler{svc: svc}
}

func (h *AuthHandler) SignUp(ctx context.Context, req *authpb.SignUpRequest) (*authpb.TokenResponse, error) {
	bundle, err := h.svc.SignUp(ctx, service.SignUpInput{
		Email:     req.GetEmail(),
		Password:  req.GetPassword(),
		FirstName: req.GetFirstName(),
		LastName:  req.GetLastName(),
		UserType:  req.GetUserType(),
	})
	if err != nil {
		return nil, mapError(err)
	}

	return toTokenResponse(bundle), nil
}

func (h *AuthHandler) Login(ctx context.Context, req *authpb.LoginRequest) (*authpb.TokenResponse, error) {
	bundle, err := h.svc.Login(ctx, service.LoginInput{Email: req.GetIdentifier(), Password: req.GetPassword()})
	if err != nil {
		return nil, mapError(err)
	}
	return toTokenResponse(bundle), nil
}

func (h *AuthHandler) Refresh(ctx context.Context, req *authpb.RefreshRequest) (*authpb.TokenResponse, error) {
	bundle, err := h.svc.Refresh(ctx, req.GetRefreshToken())
	if err != nil {
		return nil, mapError(err)
	}
	return toTokenResponse(bundle), nil
}

func (h *AuthHandler) Logout(ctx context.Context, req *authpb.LogoutRequest) (*emptypb.Empty, error) {
	if err := h.svc.Logout(ctx, req.GetRefreshToken()); err != nil {
		return nil, mapError(err)
	}
	return &emptypb.Empty{}, nil
}

func (h *AuthHandler) ValidateToken(ctx context.Context, req *authpb.ValidateTokenRequest) (*authpb.ValidateTokenResponse, error) {
	profile, expiresAt, err := h.svc.Validate(ctx, req.GetAccessToken())
	if err != nil {
		return nil, mapError(err)
	}

	resp := &authpb.ValidateTokenResponse{User: toUserProfile(profile)}
	if !expiresAt.IsZero() {
		resp.ExpiresAt = timestamppb.New(expiresAt)
	}
	return resp, nil
}

func toTokenResponse(bundle service.TokenBundle) *authpb.TokenResponse {
	resp := &authpb.TokenResponse{
		AccessToken:  bundle.AccessToken,
		RefreshToken: bundle.RefreshToken,
		ExpiresAt:    timestamppb.New(bundle.ExpiresAt),
	}
	if bundle.Profile.ID != "" {
		resp.User = toUserProfile(bundle.Profile)
	}
	return resp
}

func toUserProfile(profile service.UserProfile) *authpb.UserProfile {
	return &authpb.UserProfile{
		Id:        profile.ID,
		Email:     profile.Email,
		FirstName: profile.FirstName,
		LastName:  profile.LastName,
		Roles:     append([]string{}, profile.Roles...),
		Status:    profile.Status,
		UserType:  profile.UserType,
	}
}

func mapError(err error) error {
	if err == nil {
		return nil
	}

	switch {
	case errors.Is(err, service.ErrEmailExists):
		return status.Error(codes.AlreadyExists, err.Error())
	case errors.Is(err, service.ErrInvalidCredentials):
		return status.Error(codes.Unauthenticated, err.Error())
	case errors.Is(err, service.ErrAccountDisabled):
		return status.Error(codes.PermissionDenied, err.Error())
	case errors.Is(err, service.ErrRefreshTokenInvalid), errors.Is(err, service.ErrRefreshTokenExpired), errors.Is(err, service.ErrTokenInvalid), errors.Is(err, service.ErrTokenExpired):
		return status.Error(codes.Unauthenticated, err.Error())
	case errors.Is(err, service.ErrUserNotFound):
		return status.Error(codes.NotFound, err.Error())
	default:
		return status.Error(codes.Internal, err.Error())
	}
}
