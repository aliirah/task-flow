package main

import (
	"context"
	"fmt"
	"net"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"github.com/aliirah/task-flow/services/user-service/internal/event"
	"github.com/aliirah/task-flow/services/user-service/internal/handler"
	"github.com/aliirah/task-flow/services/user-service/internal/models"
	"github.com/aliirah/task-flow/services/user-service/internal/service"
	"github.com/aliirah/task-flow/shared/db/gormdb"
	"github.com/aliirah/task-flow/shared/env"
	log "github.com/aliirah/task-flow/shared/logging"
	"github.com/aliirah/task-flow/shared/messaging"
	"github.com/aliirah/task-flow/shared/metrics"
	userpb "github.com/aliirah/task-flow/shared/proto/user/v1"
	"github.com/aliirah/task-flow/shared/tracing"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"google.golang.org/grpc"
)

func main() {
	loggerCfg := log.Config{
		Directory: env.GetString("LOG_DIR", "logs"),
		Filename:  env.GetString("LOG_FILE", "user-service"),
		Level:     env.GetString("LOG_LEVEL", "info"),
	}
	if _, err := log.Init(loggerCfg); err != nil {
		fmt.Fprintf(os.Stderr, "failed to initialise logger: %v\n", err)
		os.Exit(1)
	}
	defer log.Sync()

	// TODO: remove logging once log file verification is complete
	log.Info("user-service logger initialised")

	tracerCfg := tracing.Config{
		ServiceName:    "user-service",
		Environment:    env.GetString("ENVIRONMENT", "development"),
		JaegerEndpoint: env.GetString("JAEGER_ENDPOINT", "http://jaeger:14268/api/traces"),
	}
	shutdown, err := tracing.InitTracer(tracerCfg)
	if err != nil {
		log.Error(fmt.Errorf("failed to init tracer: %w", err))
		os.Exit(1)
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

	rabbitURI := env.GetString("RABBITMQ_URI", "amqp://guest:guest@rabbitmq:5672/")
	rabbit, err := messaging.NewRabbitMQ(rabbitURI)
	if err != nil {
		log.Error(fmt.Errorf("failed to init rabbitmq: %w", err))
		os.Exit(1)
	}
	defer rabbit.Close()

	userPublisher := event.NewUserPublisher(rabbit)
	userSvc := service.NewUserService(db, userPublisher)
	userHandler := handler.NewUserHandler(userSvc)

	addr := env.GetString("USER_GRPC_ADDR", ":50052")

	// Initialize gRPC server with metrics interceptor
	grpcServer := grpc.NewServer(
		grpc.StatsHandler(otelgrpc.NewServerHandler()),
		grpc.UnaryInterceptor(metrics.UnaryServerInterceptor()),
	)
	userpb.RegisterUserServiceServer(grpcServer, userHandler)

	// Start metrics HTTP server
	metricsAddr := env.GetString("METRICS_ADDR", ":9090")
	go func() {
		gin.SetMode(gin.ReleaseMode)
		router := gin.New()
		router.Use(gin.Recovery())
		router.Use(metrics.GinMiddleware("user-service"))

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

	log.Infof("User service listening on %s", addr)
	if err := grpcServer.Serve(lis); err != nil {
		log.Error(fmt.Errorf("user service stopped: %w", err))
		os.Exit(1)
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
