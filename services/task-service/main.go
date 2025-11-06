package main

import (
	"context"
	"fmt"
	"net"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"github.com/aliirah/task-flow/services/task-service/internal/event"
	"github.com/aliirah/task-flow/services/task-service/internal/handler"
	"github.com/aliirah/task-flow/services/task-service/internal/models"
	"github.com/aliirah/task-flow/services/task-service/internal/service"
	"github.com/aliirah/task-flow/shared/db/gormdb"
	"github.com/aliirah/task-flow/shared/env"
	"github.com/aliirah/task-flow/shared/grpcutil"
	log "github.com/aliirah/task-flow/shared/logging"
	"github.com/aliirah/task-flow/shared/messaging"
	"github.com/aliirah/task-flow/shared/metrics"
	taskpb "github.com/aliirah/task-flow/shared/proto/task/v1"
	"github.com/aliirah/task-flow/shared/tracing"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"google.golang.org/grpc"
)

var rabbitMqURI = env.GetString("RABBITMQ_URI", "amqp://guest:guest@rabbitmq:5672/")

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

	rabbitMQ, err := messaging.NewRabbitMQ(rabbitMqURI)
	if err != nil {
		log.Error(fmt.Errorf("failed to connect to RabbitMQ: %w", err))
		os.Exit(1)
	}
	defer rabbitMQ.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	defer shutdown(ctx)

	// gRPC connections
	authAddr := env.GetString("AUTH_SERVICE_ADDR", "auth-service:50051")
	userAddr := env.GetString("USER_SERVICE_ADDR", "user-service:50052")
	orgAddr := env.GetString("ORG_SERVICE_ADDR", "organization-service:50053")
	taskAddr := env.GetString("TASK_SERVICE_ADDR", "task-service:50054")

	grpcClients, err := grpcutil.Dial(ctx, grpcutil.Config{
		AuthAddr:         authAddr,
		UserAddr:         userAddr,
		OrganizationAddr: orgAddr,
		TaskAddr:         taskAddr,
	})
	if err != nil {
		log.Error(fmt.Errorf("failed to connect downstream services: %w", err))
		os.Exit(1)
	}
	defer grpcClients.Close()

	// Initialize task event publisher
	taskPublisher := event.NewTaskPublisher(rabbitMQ)

	taskSvc := service.New(db, taskPublisher, grpcClients.User)
	taskHandler := handler.NewTaskHandler(taskSvc)

	addr := env.GetString("TASK_GRPC_ADDR", ":50054")

	// Initialize gRPC server with metrics interceptor
	grpcServer := grpc.NewServer(
		grpc.StatsHandler(otelgrpc.NewServerHandler()),
		grpc.UnaryInterceptor(metrics.UnaryServerInterceptor()),
	)
	taskpb.RegisterTaskServiceServer(grpcServer, taskHandler)

	// Start metrics HTTP server
	metricsAddr := env.GetString("METRICS_ADDR", ":9090")
	go func() {
		gin.SetMode(gin.ReleaseMode)
		router := gin.New()
		router.Use(gin.Recovery())
		router.Use(metrics.GinMiddleware("task-service"))

		// Add metrics endpoint
		router.GET("/metrics", gin.WrapH(promhttp.Handler()))

		log.Infof("Metrics server listening on %s", metricsAddr)
		if err := router.Run(metricsAddr); err != nil {
			log.Error(fmt.Errorf("metrics server stopped: %w", err))
			os.Exit(1)
		}
	}()

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
