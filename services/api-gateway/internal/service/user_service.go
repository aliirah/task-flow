package service

import (
	"context"
	"errors"

	userpb "github.com/aliirah/task-flow/shared/proto/user/v1"
	wrapperspb "google.golang.org/protobuf/types/known/wrapperspb"
)

type User = userpb.User

type UserFilter struct {
	Query string
	Role  string
	Page  int
	Limit int
}

type UserCreateInput = userpb.CreateUserRequest

type UserUpdateInput struct {
	FirstName *string   `json:"firstName,omitempty"`
	LastName  *string   `json:"lastName,omitempty"`
	Roles     *[]string `json:"roles,omitempty"`
	Status    *string   `json:"status,omitempty"`
	UserType  *string   `json:"userType,omitempty"`
}

type ProfileUpdateInput struct {
	FirstName *string `json:"firstName,omitempty"`
	LastName  *string `json:"lastName,omitempty"`
}

type UserService interface {
	List(ctx context.Context, filter UserFilter) ([]*User, error)
	Get(ctx context.Context, id string) (*User, error)
	Create(ctx context.Context, input *UserCreateInput) (*User, error)
	Update(ctx context.Context, id string, input *UserUpdateInput) (*User, error)
	Delete(ctx context.Context, id string) error
	UpdateProfile(ctx context.Context, userID string, input *ProfileUpdateInput) (*User, error)
	ListByIDs(ctx context.Context, ids []string) ([]*User, error)
}

type userService struct {
	client userpb.UserServiceClient
}

func NewUserService(client userpb.UserServiceClient) UserService {
	return &userService{client: client}
}

func (s *userService) List(ctx context.Context, filter UserFilter) ([]*User, error) {
	if s.client == nil {
		return nil, errors.New("user service client not configured")
	}
	ctx = withOutgoingAuth(ctx)
	if filter.Page <= 0 {
		filter.Page = 1
	}
	if filter.Limit <= 0 {
		filter.Limit = 20
	}
	req := &userpb.ListUsersRequest{
		Query: filter.Query,
		Role:  filter.Role,
		Page:  int32(filter.Page),
		Limit: int32(filter.Limit),
	}
	resp, err := s.client.ListUsers(ctx, req)
	if err != nil {
		return nil, err
	}
	return resp.GetItems(), nil
}

func (s *userService) Get(ctx context.Context, id string) (*User, error) {
	if s.client == nil {
		return nil, errors.New("user service client not configured")
	}
	ctx = withOutgoingAuth(ctx)
	return s.client.GetUser(ctx, &userpb.GetUserRequest{Id: id})
}

func (s *userService) Create(ctx context.Context, input *UserCreateInput) (*User, error) {
	if s.client == nil {
		return nil, errors.New("user service client not configured")
	}
	ctx = withOutgoingAuth(ctx)
	return s.client.CreateUser(ctx, (*userpb.CreateUserRequest)(input))
}

func (s *userService) Update(ctx context.Context, id string, input *UserUpdateInput) (*User, error) {
	if s.client == nil {
		return nil, errors.New("user service client not configured")
	}
	ctx = withOutgoingAuth(ctx)
	req := &userpb.UpdateUserRequest{Id: id}
	if input.FirstName != nil {
		req.FirstName = wrapperspb.String(*input.FirstName)
	}
	if input.LastName != nil {
		req.LastName = wrapperspb.String(*input.LastName)
	}
	if input.Roles != nil {
		req.Roles = &userpb.UserRoles{Values: *input.Roles}
	}
	if input.Status != nil {
		req.Status = wrapperspb.String(*input.Status)
	}
	if input.UserType != nil {
		req.UserType = wrapperspb.String(*input.UserType)
	}
	return s.client.UpdateUser(ctx, req)
}

func (s *userService) Delete(ctx context.Context, id string) error {
	if s.client == nil {
		return errors.New("user service client not configured")
	}
	ctx = withOutgoingAuth(ctx)
	_, err := s.client.DeleteUser(ctx, &userpb.DeleteUserRequest{Id: id})
	return err
}

func (s *userService) UpdateProfile(ctx context.Context, userID string, input *ProfileUpdateInput) (*User, error) {
	if s.client == nil {
		return nil, errors.New("user service client not configured")
	}
	ctx = withOutgoingAuth(ctx)
	req := &userpb.UpdateProfileRequest{UserId: userID}
	if input.FirstName != nil {
		req.FirstName = wrapperspb.String(*input.FirstName)
	}
	if input.LastName != nil {
		req.LastName = wrapperspb.String(*input.LastName)
	}
	return s.client.UpdateProfile(ctx, req)
}

func (s *userService) ListByIDs(ctx context.Context, ids []string) ([]*User, error) {
	if s.client == nil {
		return nil, errors.New("user service client not configured")
	}
	if len(ids) == 0 {
		return []*User{}, nil
	}
	ctx = withOutgoingAuth(ctx)
	resp, err := s.client.ListUsersByIDs(ctx, &userpb.ListUsersByIDsRequest{Ids: ids})
	if err != nil {
		return nil, err
	}
	return resp.GetItems(), nil
}
