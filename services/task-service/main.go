package main

import (
	"context"
	"fmt"
	"net"
	"os"
	"time"

	"github.com/aliirah/task-flow/services/task-service/internal/handler"
	"github.com/aliirah/task-flow/services/task-service/internal/models"
	"github.com/aliirah/task-flow/services/task-service/internal/service"
	"github.com/aliirah/task-flow/shared/db/gormdb"
	"github.com/aliirah/task-flow/shared/env"
	log "github.com/aliirah/task-flow/shared/logging"
	taskpb "github.com/aliirah/task-flow/shared/proto/task/v1"
	"github.com/aliirah/task-flow/shared/tracing"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"google.golang.org/grpc"
)

func main() {
	loggerCfg := log.Config{
		Directory: env.GetString("LOG_DIR", "logs"),
		Filename:  env.GetString("LOG_FILE", "task-service"),
		Level:     env.GetString("LOG_LEVEL", "info"),
	}
	if _, err := log.Init(loggerCfg); err != nil {
		fmt.Fprintf(os.Stderr, "failed to initialise logger: %v\n", err)
		os.Exit(1)
	}
	defer log.Sync()

	// TODO: remove logging once log file verification is complete
	log.Info("task-service logger initialised")

	tracerCfg := tracing.Config{
		ServiceName:    "task-service",
		Environment:    env.GetString("ENVIRONMENT", "development"),
		JaegerEndpoint: env.GetString("JAEGER_ENDPOINT", "http://jaeger:14268/api/traces"),
	}
	shutdown, err := tracing.InitTracer(tracerCfg)
	if err != nil {
		log.Error(fmt.Errorf("failed to init tracer: %w", err))
		os.Exit(1)
	}
	defer shutdown(context.Background())

	dsn := buildDSNFromEnv()
	db, err := gormdb.Open(gormdb.Config{
		DSN:             dsn,
		MaxIdleConns:    5,
		MaxOpenConns:    10,
		ConnMaxLifetime: time.Hour,
	})
	if err != nil {
		log.Error(fmt.Errorf("failed to connect database: %w", err))
		os.Exit(1)
	}
	sqlDB, err := db.DB()
	if err != nil {
		log.Error(fmt.Errorf("failed to obtain sql db: %w", err))
		os.Exit(1)
	}
	defer sqlDB.Close()

	if err := models.AutoMigrate(db); err != nil {
		log.Error(fmt.Errorf("auto migrate failed: %w", err))
		os.Exit(1)
	}

	taskSvc := service.New(db)
	taskHandler := handler.NewTaskHandler(taskSvc)

	addr := env.GetString("TASK_GRPC_ADDR", ":50054")

	grpcServer := grpc.NewServer(
		grpc.StatsHandler(otelgrpc.NewServerHandler()),
	)
	taskpb.RegisterTaskServiceServer(grpcServer, taskHandler)

	lis, err := net.Listen("tcp", addr)
	if err != nil {
		log.Error(fmt.Errorf("failed to listen: %w", err))
		os.Exit(1)
	}

	log.Infof("Task service listening on %s", addr)
	if err := grpcServer.Serve(lis); err != nil {
		log.Error(fmt.Errorf("task service stopped: %w", err))
		os.Exit(1)
	}
}

func buildDSNFromEnv() string {
	if dsn := os.Getenv("TASK_DATABASE_URL"); dsn != "" {
		return dsn
	}

	host := env.GetString("TASK_DB_HOST", "task-db")
	port := env.GetString("TASK_DB_PORT", "5432")
	user := env.GetString("TASK_DB_USER", "task_service")
	pass := env.GetString("TASK_DB_PASSWORD", "task_service")
	name := env.GetString("TASK_DB_NAME", "task_service")

	return fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable", user, pass, host, port, name)
}
