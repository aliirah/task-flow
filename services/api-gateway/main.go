package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"time"

	requestid "github.com/gin-contrib/requestid"
	"github.com/gin-gonic/gin"

	gatewayevent "github.com/aliirah/task-flow/services/api-gateway/internal/event"
	httphandler "github.com/aliirah/task-flow/services/api-gateway/internal/handler/http"
	wshandler "github.com/aliirah/task-flow/services/api-gateway/internal/handler/ws"
	gatewaymiddleware "github.com/aliirah/task-flow/services/api-gateway/internal/middleware"
	gatewayservice "github.com/aliirah/task-flow/services/api-gateway/internal/service"
	"github.com/aliirah/task-flow/services/api-gateway/routes"
	"github.com/aliirah/task-flow/shared/env"
	grpcutil "github.com/aliirah/task-flow/shared/grpcutil"
	log "github.com/aliirah/task-flow/shared/logging"
	"github.com/aliirah/task-flow/shared/messaging"
	"github.com/aliirah/task-flow/shared/tracing"
	"go.uber.org/zap"
)

var (
	httpAddr    = env.GetString("HTTP_ADDR", ":8081")
	rabbitMqURI = env.GetString("RABBITMQ_URI", "amqp://guest:guest@rabbitmq:5672/")
)

func main() {
	loggerCfg := log.Config{
		Directory: env.GetString("LOG_DIR", "logs"),
		Filename:  env.GetString("LOG_FILE", "api-gateway"),
		Level:     env.GetString("LOG_LEVEL", "info"),
	}
	if _, err := log.Init(loggerCfg); err != nil {
		fmt.Fprintf(os.Stderr, "failed to initialise logger: %v\n", err)
		os.Exit(1)
	}
	defer log.Sync()

	// TODO: remove logging once log file verification is complete
	log.Info("api-gateway logger initialised")

	// init tracing
	tracerCfg := tracing.Config{
		ServiceName:    "api-gateway",
		Environment:    env.GetString("ENVIRONMENT", "development"),
		JaegerEndpoint: env.GetString("JAEGER_ENDPOINT", "http://jaeger:14268/api/traces"),
	}

	sh, err := tracing.InitTracer(tracerCfg)
	if err != nil {
		log.Error(fmt.Errorf("failed to initialize tracer: %w", err))
		os.Exit(1)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	defer sh(ctx)

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

	// RabbitMQ connection
	rabbitmq, err := messaging.NewRabbitMQ(rabbitMqURI)
	if err != nil {
		log.Error(fmt.Errorf("failed to connect RabbitMQ: %w", err))
		os.Exit(1)
	}
	defer rabbitmq.Close()

	connMgr := messaging.NewConnectionManager()

	consumer := messaging.NewQueueConsumer(rabbitmq, connMgr, messaging.TaskEventsQueue)
	if err := consumer.Start(); err != nil {
		log.Error(fmt.Errorf("failed to start task events consumer: %w", err))
		os.Exit(1)
	}

	router := gin.Default()
	router.Use(
		requestid.New(),
		gatewaymiddleware.RequestContext(),
		gatewaymiddleware.ErrorHandler(),
		gatewaymiddleware.HTTPTracing(),
	)
	healthHandler := httphandler.NewHealthHandler(gatewayservice.NewHealthService())
	authSvc := gatewayservice.NewAuthService(grpcClients.Auth)
	userSvc := gatewayservice.NewUserService(grpcClients.User)
	orgSvc := gatewayservice.NewOrganizationService(grpcClients.Organization, userSvc)
	taskSvc := gatewayservice.NewTaskService(grpcClients.Task, userSvc, orgSvc)
	taskPublisher := gatewayevent.NewTaskPublisher(rabbitmq)

	authHandler := httphandler.NewAuthHandler(authSvc)
	userHandler := httphandler.NewUserHandler(userSvc)
	organizationHandler := httphandler.NewOrganizationHandler(orgSvc)
	taskHandler := httphandler.NewTaskHandler(taskSvc, taskPublisher)
	wsHandler := wshandler.NewHandler(authSvc, orgSvc, connMgr)
	authMiddleware := gatewaymiddleware.JWTAuth(authSvc)

	routes.Register(router, routes.Dependencies{
		Health:         healthHandler,
		Auth:           authHandler,
		User:           userHandler,
		Organization:   organizationHandler,
		Task:           taskHandler,
		WS:             wsHandler,
		AuthMiddleware: authMiddleware,
	})
	s := &http.Server{
		Addr:           httpAddr,
		Handler:        router,
		ReadTimeout:    10 * time.Second,
		WriteTimeout:   10 * time.Second,
		MaxHeaderBytes: 1 << 20,
	}
	if err := s.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Error(fmt.Errorf("http server error: %w", err), zap.String("addr", httpAddr))
		os.Exit(1)
	}
}
