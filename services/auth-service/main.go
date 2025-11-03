package main

import (
	"context"
	"log"
	"net"
	"time"

	"github.com/aliirah/task-flow/shared/env"
	authpb "github.com/aliirah/task-flow/shared/proto/auth/v1"
	"github.com/aliirah/task-flow/shared/tracing"
	"google.golang.org/grpc"
	emptypb "google.golang.org/protobuf/types/known/emptypb"
	timestamppb "google.golang.org/protobuf/types/known/timestamppb"
)

type authServer struct {
	authpb.UnimplementedAuthServiceServer
}

func newAuthServer() authpb.AuthServiceServer {
	return &authServer{}
}

func (s *authServer) Login(ctx context.Context, req *authpb.LoginRequest) (*authpb.TokenResponse, error) {
	log.Printf("AuthService.Login identifier=%s", req.GetIdentifier())
	return &authpb.TokenResponse{
		AccessToken:  "access-token-" + req.GetIdentifier(),
		RefreshToken: "refresh-token-" + req.GetIdentifier(),
		ExpiresAt:    timestamppb.New(time.Now().Add(15 * time.Minute).UTC()),
	}, nil
}

func (s *authServer) Refresh(ctx context.Context, req *authpb.RefreshRequest) (*authpb.TokenResponse, error) {
	log.Printf("AuthService.Refresh refreshToken=%s", req.GetRefreshToken())
	return &authpb.TokenResponse{
		AccessToken:  "refreshed-access-token",
		RefreshToken: "next-refresh-token",
		ExpiresAt:    timestamppb.New(time.Now().Add(15 * time.Minute).UTC()),
	}, nil
}

func (s *authServer) Logout(ctx context.Context, req *authpb.LogoutRequest) (*emptypb.Empty, error) {
	log.Printf("AuthService.Logout accessToken=%s", req.GetAccessToken())
	return &emptypb.Empty{}, nil
}

func main() {
	tracerCfg := tracing.Config{
		ServiceName:    "auth-service",
		Environment:    env.GetString("ENVIRONMENT", "development"),
		JaegerEndpoint: env.GetString("JAEGER_ENDPOINT", "http://jaeger:14268/api/traces"),
	}
	shutdown, err := tracing.InitTracer(tracerCfg)
	if err != nil {
		log.Fatalf("failed to init tracer: %v", err)
	}
	defer shutdown(context.Background())

	addr := env.GetString("AUTH_GRPC_ADDR", ":50051")

	grpcServer := grpc.NewServer()
	authpb.RegisterAuthServiceServer(grpcServer, newAuthServer())

	lis, err := net.Listen("tcp", addr)
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	log.Printf("Auth service listening on %s", addr)
	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("auth service stopped: %v", err)
	}
}
