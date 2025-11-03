package main

import (
	"context"
	"log"
	"net"
	"time"

	"github.com/aliirah/task-flow/shared/env"
	userpb "github.com/aliirah/task-flow/shared/proto/user/v1"
	"github.com/aliirah/task-flow/shared/tracing"
	"google.golang.org/grpc"
	emptypb "google.golang.org/protobuf/types/known/emptypb"
	timestamppb "google.golang.org/protobuf/types/known/timestamppb"
)

type userServer struct {
	userpb.UnimplementedUserServiceServer
}

func newUserServer() userpb.UserServiceServer {
	return &userServer{}
}

func (s *userServer) ListUsers(ctx context.Context, req *userpb.ListUsersRequest) (*userpb.ListUsersResponse, error) {
	log.Printf("UserService.ListUsers query=%s role=%s", req.GetQuery(), req.GetRole())
	return &userpb.ListUsersResponse{
		Items: []*userpb.User{
			s.sampleUser("user-1", "alice@example.com", []string{"user"}),
			s.sampleUser("user-2", "bob@example.com", []string{"admin"}),
		},
	}, nil
}

func (s *userServer) GetUser(ctx context.Context, req *userpb.GetUserRequest) (*userpb.User, error) {
	log.Printf("UserService.GetUser id=%s", req.GetId())
	return s.sampleUser(req.GetId(), "user@example.com", []string{"user"}), nil
}

func (s *userServer) CreateUser(ctx context.Context, req *userpb.CreateUserRequest) (*userpb.User, error) {
	log.Printf("UserService.CreateUser email=%s", req.GetEmail())
	return s.sampleUser("new-user-id", req.GetEmail(), req.GetRoles()), nil
}

func (s *userServer) UpdateUser(ctx context.Context, req *userpb.UpdateUserRequest) (*userpb.User, error) {
	log.Printf("UserService.UpdateUser id=%s", req.GetId())
	user := s.sampleUser(req.GetId(), "user@example.com", []string{"user"})
	if req.GetFirstName() != nil {
		user.FirstName = req.GetFirstName().GetValue()
	}
	if req.GetLastName() != nil {
		user.LastName = req.GetLastName().GetValue()
	}
	if req.GetRoles() != nil {
		user.Roles = append([]string(nil), req.GetRoles().GetValues()...)
	}
	if req.GetStatus() != nil {
		user.Status = req.GetStatus().GetValue()
	}
	user.UpdatedAt = timestamppb.Now()
	return user, nil
}

func (s *userServer) DeleteUser(ctx context.Context, req *userpb.DeleteUserRequest) (*emptypb.Empty, error) {
	log.Printf("UserService.DeleteUser id=%s", req.GetId())
	return &emptypb.Empty{}, nil
}

func (s *userServer) UpdateProfile(ctx context.Context, req *userpb.UpdateProfileRequest) (*userpb.User, error) {
	log.Printf("UserService.UpdateProfile userId=%s", req.GetUserId())
	user := s.sampleUser(req.GetUserId(), "user@example.com", []string{"user"})
	if req.GetFirstName() != nil {
		user.FirstName = req.GetFirstName().GetValue()
	}
	if req.GetLastName() != nil {
		user.LastName = req.GetLastName().GetValue()
	}
	user.UpdatedAt = timestamppb.Now()
	return user, nil
}

func (s *userServer) sampleUser(id, email string, roles []string) *userpb.User {
	now := time.Now().UTC()
	return &userpb.User{
		Id:        id,
		Email:     email,
		FirstName: "Sample",
		LastName:  "User",
		Roles:     append([]string(nil), roles...),
		Status:    "active",
		CreatedAt: timestamppb.New(now.Add(-24 * time.Hour)),
		UpdatedAt: timestamppb.New(now),
	}
}

func main() {
	tracerCfg := tracing.Config{
		ServiceName:    "user-service",
		Environment:    env.GetString("ENVIRONMENT", "development"),
		JaegerEndpoint: env.GetString("JAEGER_ENDPOINT", "http://jaeger:14268/api/traces"),
	}
	shutdown, err := tracing.InitTracer(tracerCfg)
	if err != nil {
		log.Fatalf("failed to init tracer: %v", err)
	}
	defer shutdown(context.Background())

	addr := env.GetString("USER_GRPC_ADDR", ":50052")

	grpcServer := grpc.NewServer()
	userpb.RegisterUserServiceServer(grpcServer, newUserServer())

	lis, err := net.Listen("tcp", addr)
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	log.Printf("User service listening on %s", addr)
	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("user service stopped: %v", err)
	}
}
