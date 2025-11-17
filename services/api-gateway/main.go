package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"time"

	requestid "github.com/gin-contrib/requestid"
	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

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
	"github.com/aliirah/task-flow/shared/metrics"
	searchpb "github.com/aliirah/task-flow/shared/proto/search/v1"
	"github.com/aliirah/task-flow/shared/tracing"
	"go.uber.org/zap"
)

var (
	httpAddr    = env.GetString("HTTP_ADDR", ":8081")
	metricsAddr = env.GetString("METRICS_ADDR", ":9090")
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
	notifAddr := env.GetString("NOTIFICATION_SERVICE_ADDR", "notification-service:50055")

	grpcClients, err := grpcutil.Dial(ctx, grpcutil.Config{
		AuthAddr:         authAddr,
		UserAddr:         userAddr,
		OrganizationAddr: orgAddr,
		TaskAddr:         taskAddr,
		NotificationAddr: notifAddr,
	})
	if err != nil {
		log.Error(fmt.Errorf("failed to connect downstream services: %w", err))
		os.Exit(1)
	}
	defer grpcClients.Close()

	searchGrpcAddr := env.GetString("SEARCH_SERVICE_GRPC_ADDR", "search-service:9091")
	searchConn, err := grpc.DialContext(
		ctx,
		searchGrpcAddr,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithStatsHandler(otelgrpc.NewClientHandler()),
	)
	if err != nil {
		log.Error(fmt.Errorf("failed to connect search service: %w", err))
		os.Exit(1)
	}
	defer searchConn.Close()

	// RabbitMQ connection
	fmt.Printf("Connecting to RabbitMQ at %s\n", rabbitMqURI)
	rabbitmq, err := messaging.NewRabbitMQ(rabbitMqURI)
	if err != nil {
		log.Error(fmt.Errorf("failed to connect RabbitMQ: %w", err))
		os.Exit(1)
	}
	defer rabbitmq.Close()
	fmt.Println("Successfully connected to RabbitMQ")

	// Initialize connection manager for WebSocket connections
	connMgr := messaging.NewConnectionManager()

	// Initialize task event consumer
	fmt.Println("Setting up task event consumer...")
	taskEventConsumer := gatewayevent.NewTaskConsumer(rabbitmq, connMgr)

	// Start listening for task events
	go func() {
		if err := taskEventConsumer.Listen(); err != nil {
			log.Error(fmt.Errorf("failed to start task event consumer: %w", err))
			os.Exit(1)
		}
	}()
	fmt.Println("Task event consumer successfully initialized")

	// Initialize comment event consumer
	fmt.Println("Setting up comment event consumer...")
	commentEventConsumer := gatewayevent.NewCommentConsumer(rabbitmq, connMgr)

	// Start listening for comment events
	go func() {
		if err := commentEventConsumer.Listen(); err != nil {
			log.Error(fmt.Errorf("failed to start comment event consumer: %w", err))
			os.Exit(1)
		}
	}()
	fmt.Println("Comment event consumer successfully initialized")

	// Initialize notification event consumer
	fmt.Println("Setting up notification event consumer...")
	notificationEventConsumer := gatewayevent.NewNotificationConsumer(rabbitmq, connMgr)

	// Start listening for notification messages
	go func() {
		if err := notificationEventConsumer.Listen(); err != nil {
			log.Error(fmt.Errorf("failed to start notification event consumer: %w", err))
			os.Exit(1)
		}
	}()
	fmt.Println("Notification event consumer successfully initialized")

	// Initialize router with metrics middleware
	router := gin.Default()
	router.Use(
		requestid.New(),
		gatewaymiddleware.RequestContext(),
		gatewaymiddleware.ErrorHandler(),
		gatewaymiddleware.CORS(),
		gatewaymiddleware.HTTPTracing(),
		metrics.GinMiddleware("api-gateway"),
	)

	// Add metrics endpoint
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))
	healthHandler := httphandler.NewHealthHandler(gatewayservice.NewHealthService())
	authSvc := gatewayservice.NewAuthService(grpcClients.Auth)
	userSvc := gatewayservice.NewUserService(grpcClients.User)
	orgSvc := gatewayservice.NewOrganizationService(grpcClients.Organization, userSvc)
	taskSvc := gatewayservice.NewTaskService(grpcClients.Task, userSvc, orgSvc)
	notifSvc := gatewayservice.NewNotificationService(grpcClients.Notification)
	searchSvc := gatewayservice.NewSearchService(
		searchpb.NewSearchServiceClient(searchConn),
		orgSvc,
		env.GetString("SEARCH_SERVICE_URL", "http://search-service:8080"),
		env.GetString("SEARCH_SERVICE_TOKEN", ""),
	)

	authHandler := httphandler.NewAuthHandler(authSvc)
	userHandler := httphandler.NewUserHandler(userSvc)
	organizationHandler := httphandler.NewOrganizationHandler(orgSvc)
	taskHandler := httphandler.NewTaskHandler(taskSvc)
	notificationHandler := httphandler.NewNotificationHandler(notifSvc)
	searchHandler := httphandler.NewSearchHandler(searchSvc)
	wsHandler := wshandler.NewHandler(authSvc, orgSvc, connMgr)
	authMiddleware := gatewaymiddleware.JWTAuth(authSvc)

	// Organization membership middleware generator
	orgMiddlewareGen := func(paramName string) gin.HandlerFunc {
		return gatewaymiddleware.RequireOrganizationMember(orgSvc, paramName)
	}

	routes.Register(router, routes.Dependencies{
		Health:                    healthHandler,
		Auth:                      authHandler,
		User:                      userHandler,
		Organization:              organizationHandler,
		Task:                      taskHandler,
		Search:                    searchHandler,
		Notification:              notificationHandler,
		WS:                        wsHandler,
		AuthMiddleware:            authMiddleware,
		OrganizationMiddlewareGen: orgMiddlewareGen,
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
