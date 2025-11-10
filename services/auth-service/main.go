package main

import (
	"context"
	"fmt"
	"net"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"github.com/aliirah/task-flow/services/auth-service/internal/handler"
	"github.com/aliirah/task-flow/services/auth-service/internal/models"
	"github.com/aliirah/task-flow/services/auth-service/internal/service"
	"github.com/aliirah/task-flow/shared/db/gormdb"
	"github.com/aliirah/task-flow/shared/env"
	log "github.com/aliirah/task-flow/shared/logging"
	"github.com/aliirah/task-flow/shared/metrics"
	authpb "github.com/aliirah/task-flow/shared/proto/auth/v1"
	userpb "github.com/aliirah/task-flow/shared/proto/user/v1"
	"github.com/aliirah/task-flow/shared/tracing"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

func main() {
	loggerCfg := log.Config{
		Directory: env.GetString("LOG_DIR", "logs"),
		Filename:  env.GetString("LOG_FILE", "auth-service"),
		Level:     env.GetString("LOG_LEVEL", "info"),
	}
	if _, err := log.Init(loggerCfg); err != nil {
		fmt.Fprintf(os.Stderr, "failed to initialise logger: %v\n", err)
		os.Exit(1)
	}
	defer log.Sync()

	// TODO: remove logging once log file verification is complete
	log.Info("auth-service logger initialised")

	tracerCfg := tracing.Config{
		ServiceName:    "auth-service",
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

	userSvcAddr := env.GetString("USER_SERVICE_ADDR", "user-service:50052")
	userConn, err := grpc.DialContext(context.Background(), userSvcAddr,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithStatsHandler(otelgrpc.NewClientHandler()))
	if err != nil {
		log.Error(fmt.Errorf("failed to connect user service: %w", err))
		os.Exit(1)
	}
	defer userConn.Close()

	cfg := service.Config{
		JWTSecret:       []byte(env.GetString("AUTH_JWT_SECRET", "development-secret")),
		AccessTokenTTL:  parseDuration(env.GetString("AUTH_ACCESS_TOKEN_TTL", "1h"), time.Hour),
		RefreshTokenTTL: parseDuration(env.GetString("AUTH_REFRESH_TOKEN_TTL", "720h"), 30*24*time.Hour),
	}

	authSvc := service.NewAuthService(db, cfg, userpb.NewUserServiceClient(userConn))
	authHandler := handler.NewAuthHandler(authSvc)

	addr := env.GetString("AUTH_GRPC_ADDR", ":50051")

	// Initialize gRPC server with metrics interceptor
	grpcServer := grpc.NewServer(
		grpc.StatsHandler(otelgrpc.NewServerHandler()),
		grpc.UnaryInterceptor(metrics.UnaryServerInterceptor()),
	)
	authpb.RegisterAuthServiceServer(grpcServer, authHandler)

	// Start metrics HTTP server
	metricsAddr := env.GetString("METRICS_ADDR", ":9090")
	go func() {
		gin.SetMode(gin.ReleaseMode)
		router := gin.New()
		router.Use(gin.Recovery())
		router.Use(metrics.GinMiddleware("auth-service"))

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

	log.Infof("Auth service listening on %s", addr)
	if err := grpcServer.Serve(lis); err != nil {
		log.Error(fmt.Errorf("auth service stopped: %w", err))
		os.Exit(1)
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

func parseDuration(value string, fallback time.Duration) time.Duration {
	if value == "" {
		return fallback
	}
	d, err := time.ParseDuration(value)
	if err != nil {
		return fallback
	}
	return d
}
