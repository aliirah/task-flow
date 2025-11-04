package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"os"
	"time"

	"github.com/aliirah/task-flow/services/user-service/internal/handler"
	"github.com/aliirah/task-flow/services/user-service/internal/models"
	"github.com/aliirah/task-flow/services/user-service/internal/service"
	"github.com/aliirah/task-flow/shared/db/gormdb"
	"github.com/aliirah/task-flow/shared/env"
	userpb "github.com/aliirah/task-flow/shared/proto/user/v1"
	"github.com/aliirah/task-flow/shared/tracing"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"google.golang.org/grpc"
)

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

	userSvc := service.NewUserService(db)
	userHandler := handler.NewUserHandler(userSvc)

	addr := env.GetString("USER_GRPC_ADDR", ":50052")

	grpcServer := grpc.NewServer(
		grpc.StatsHandler(otelgrpc.NewServerHandler()),
	)
	userpb.RegisterUserServiceServer(grpcServer, userHandler)

	lis, err := net.Listen("tcp", addr)
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	log.Printf("User service listening on %s", addr)
	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("user service stopped: %v", err)
	}
}

func buildDSNFromEnv() string {
	if dsn := os.Getenv("USER_DATABASE_URL"); dsn != "" {
		return dsn
	}

	host := env.GetString("USER_DB_HOST", "user-db")
	port := env.GetString("USER_DB_PORT", "5432")
	user := env.GetString("USER_DB_USER", "user_service")
	pass := env.GetString("USER_DB_PASSWORD", "user_service")
	name := env.GetString("USER_DB_NAME", "user_service")

	return fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable", user, pass, host, port, name)
}
