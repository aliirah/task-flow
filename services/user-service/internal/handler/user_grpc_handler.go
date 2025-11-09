package handler

import (
	"context"
	"errors"

	"github.com/aliirah/task-flow/services/user-service/internal/models"
	"github.com/aliirah/task-flow/services/user-service/internal/service"
	userpb "github.com/aliirah/task-flow/shared/proto/user/v1"
	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	emptypb "google.golang.org/protobuf/types/known/emptypb"
	timestamppb "google.golang.org/protobuf/types/known/timestamppb"
)

type UserHandler struct {
	userpb.UnimplementedUserServiceServer
	svc *service.UserService
}

func NewUserHandler(svc *service.UserService) *UserHandler {
	return &UserHandler{svc: svc}
}

func (h *UserHandler) ListUsers(ctx context.Context, req *userpb.ListUsersRequest) (*userpb.ListUsersResponse, error) {
	users, err := h.svc.List(ctx)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	items := make([]*userpb.User, 0, len(users))
	for _, u := range users {
		items = append(items, mapUser(u))
	}

	return &userpb.ListUsersResponse{Items: items}, nil
}

func (h *UserHandler) ListUsersByIDs(ctx context.Context, req *userpb.ListUsersByIDsRequest) (*userpb.ListUsersResponse, error) {
	if len(req.GetIds()) == 0 {
		return &userpb.ListUsersResponse{Items: []*userpb.User{}}, nil
	}

	ids := make([]uuid.UUID, 0, len(req.GetIds()))
	for _, idStr := range req.GetIds() {
		id, err := uuid.Parse(idStr)
		if err != nil {
			return nil, status.Error(codes.InvalidArgument, "invalid user id")
		}
		ids = append(ids, id)
	}

	users, err := h.svc.ListByIDs(ctx, ids)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	items := make([]*userpb.User, 0, len(users))
	for _, u := range users {
		items = append(items, mapUser(u))
	}

	return &userpb.ListUsersResponse{Items: items}, nil
}

func (h *UserHandler) GetUser(ctx context.Context, req *userpb.GetUserRequest) (*userpb.User, error) {
	id, err := uuid.Parse(req.GetId())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "invalid user id")
	}

	user, err := h.svc.Get(ctx, id)
	if err != nil {
		return nil, status.Error(codes.NotFound, err.Error())
	}

	return mapUser(*user), nil
}

func (h *UserHandler) CreateUser(ctx context.Context, req *userpb.CreateUserRequest) (*userpb.User, error) {
	id := uuid.New()
	if req.GetId() != "" {
		parsed, err := uuid.Parse(req.GetId())
		if err != nil {
			return nil, status.Error(codes.InvalidArgument, "invalid user id")
		}
		id = parsed
	}
	input := service.CreateUserInput{
		ID:        id,
		Email:     req.GetEmail(),
		FirstName: req.GetFirstName(),
		LastName:  req.GetLastName(),
		Status:    "active",
		UserType:  req.GetUserType(),
		Roles:     req.GetRoles(),
	}

	user, err := h.svc.Create(ctx, input)
	if err != nil {
		if errors.Is(err, service.ErrEmailExists) {
			return nil, status.Error(codes.AlreadyExists, err.Error())
		}
		return nil, status.Error(codes.Internal, err.Error())
	}

	return mapUser(*user), nil
}

func (h *UserHandler) UpdateUser(ctx context.Context, req *userpb.UpdateUserRequest) (*userpb.User, error) {
	id, err := uuid.Parse(req.GetId())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "invalid user id")
	}

	input := service.UpdateUserInput{}
	if req.GetFirstName() != nil {
		value := req.GetFirstName().GetValue()
		input.FirstName = &value
	}
	if req.GetLastName() != nil {
		value := req.GetLastName().GetValue()
		input.LastName = &value
	}
	if req.GetStatus() != nil {
		value := req.GetStatus().GetValue()
		input.Status = &value
	}
	if req.GetUserType() != nil {
		value := req.GetUserType().GetValue()
		input.UserType = &value
	}
	if req.GetRoles() != nil {
		roles := append([]string{}, req.GetRoles().GetValues()...)
		input.Roles = &roles
	}

	user, err := h.svc.Update(ctx, id, input)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return mapUser(*user), nil
}

func (h *UserHandler) DeleteUser(ctx context.Context, req *userpb.DeleteUserRequest) (*emptypb.Empty, error) {
	id, err := uuid.Parse(req.GetId())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "invalid user id")
	}

	if err := h.svc.Delete(ctx, id); err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return &emptypb.Empty{}, nil
}

func (h *UserHandler) UpdateProfile(ctx context.Context, req *userpb.UpdateProfileRequest) (*userpb.User, error) {
	id, err := uuid.Parse(req.GetUserId())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "invalid user id")
	}

	input := service.UpdateUserInput{}
	if req.GetFirstName() != nil {
		value := req.GetFirstName().GetValue()
		input.FirstName = &value
	}
	if req.GetLastName() != nil {
		value := req.GetLastName().GetValue()
		input.LastName = &value
	}

	user, err := h.svc.Update(ctx, id, input)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return mapUser(*user), nil
}

func mapUser(u models.User) *userpb.User {
	roles := make([]string, 0, len(u.Roles))
	for _, r := range u.Roles {
		roles = append(roles, r.Name)
	}

	return &userpb.User{
		Id:        u.ID.String(),
		Email:     u.Email,
		FirstName: u.FirstName,
		LastName:  u.LastName,
		Status:    u.Status,
		Roles:     roles,
		CreatedAt: timestamppb.New(u.CreatedAt),
		UpdatedAt: timestamppb.New(u.UpdatedAt),
		UserType:  u.UserType,
	}
}
