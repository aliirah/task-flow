package grpcutil

import (
	"context"
	"fmt"

	authpb "github.com/aliirah/task-flow/shared/proto/auth/v1"
	organizationpb "github.com/aliirah/task-flow/shared/proto/organization/v1"
	taskpb "github.com/aliirah/task-flow/shared/proto/task/v1"
	userpb "github.com/aliirah/task-flow/shared/proto/user/v1"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// Config captures downstream service connection addresses.
type Config struct {
	AuthAddr         string
	UserAddr         string
	OrganizationAddr string
	TaskAddr         string
}

// Connections bundles ready-to-use gRPC clients and tracks closers.
type Connections struct {
	Auth         authpb.AuthServiceClient
	User         userpb.UserServiceClient
	Organization organizationpb.OrganizationServiceClient
	Task         taskpb.TaskServiceClient
	closeFns     []func() error
}

// Close tears down all underlying connections in reverse order.
func (c Connections) Close() error {
	var firstErr error
	for i := len(c.closeFns) - 1; i >= 0; i-- {
		if err := c.closeFns[i](); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}

// Dial initialises gRPC connections to downstream services using common options.
func Dial(ctx context.Context, cfg Config) (Connections, error) {
	dial := func(addr string) (*grpc.ClientConn, error) {
		conn, err := grpc.DialContext(ctx, addr,
			grpc.WithTransportCredentials(insecure.NewCredentials()),
			grpc.WithStatsHandler(otelgrpc.NewClientHandler()),
		)
		if err != nil {
			return nil, fmt.Errorf("dial %s: %w", addr, err)
		}
		return conn, nil
	}

	authConn, err := dial(cfg.AuthAddr)
	if err != nil {
		return Connections{}, err
	}

	userConn, err := dial(cfg.UserAddr)
	if err != nil {
		_ = authConn.Close()
		return Connections{}, err
	}

	orgConn, err := dial(cfg.OrganizationAddr)
	if err != nil {
		_ = userConn.Close()
		_ = authConn.Close()
		return Connections{}, err
	}

	taskConn, err := dial(cfg.TaskAddr)
	if err != nil {
		_ = orgConn.Close()
		_ = userConn.Close()
		_ = authConn.Close()
		return Connections{}, err
	}

	return Connections{
		Auth:         authpb.NewAuthServiceClient(authConn),
		User:         userpb.NewUserServiceClient(userConn),
		Organization: organizationpb.NewOrganizationServiceClient(orgConn),
		Task:         taskpb.NewTaskServiceClient(taskConn),
		closeFns: []func() error{
			authConn.Close,
			userConn.Close,
			orgConn.Close,
			taskConn.Close,
		},
	}, nil
}
