package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"os"
	"time"

	"github.com/aliirah/task-flow/services/auth-service/internal/handler"
	"github.com/aliirah/task-flow/services/auth-service/internal/models"
	"github.com/aliirah/task-flow/services/auth-service/internal/service"
	"github.com/aliirah/task-flow/shared/db/gormdb"
	"github.com/aliirah/task-flow/shared/env"
	authpb "github.com/aliirah/task-flow/shared/proto/auth/v1"
	"github.com/aliirah/task-flow/shared/tracing"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"google.golang.org/grpc"
)

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

	dbDSN := buildDSNFromEnv()
	db, err := gormdb.Open(gormdb.Config{
		DSN:             dbDSN,
		MaxIdleConns:    5,
		MaxOpenConns:    10,
		ConnMaxLifetime: time.Hour,
	})
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("failed to obtain sql db: %v", err)
	}
	defer sqlDB.Close()

	if err := models.AutoMigrate(db); err != nil {
		log.Fatalf("auto migrate failed: %v", err)
	}

	addr := env.GetString("AUTH_GRPC_ADDR", ":50051")

	authSvc := service.NewAuthService(db)
	authHandler := handler.NewAuthHandler(authSvc)

	grpcServer := grpc.NewServer(
		grpc.StatsHandler(otelgrpc.NewServerHandler()),
	)
	authpb.RegisterAuthServiceServer(grpcServer, authHandler)

	lis, err := net.Listen("tcp", addr)
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	log.Printf("Auth service listening on %s", addr)
	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("auth service stopped: %v", err)
	}
}

func buildDSNFromEnv() string {
	if dsn := os.Getenv("AUTH_DATABASE_URL"); dsn != "" {
		return dsn
	}

	host := env.GetString("AUTH_DB_HOST", "auth-db")
	port := env.GetString("AUTH_DB_PORT", "5432")
	user := env.GetString("AUTH_DB_USER", "auth_service")
	pass := env.GetString("AUTH_DB_PASSWORD", "auth_service")
	name := env.GetString("AUTH_DB_NAME", "auth_service")

	return fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable", user, pass, host, port, name)
}
