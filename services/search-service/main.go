package main

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/aliirah/task-flow/services/search-service/internal/consumer"
	grpcserver "github.com/aliirah/task-flow/services/search-service/internal/grpc"
	"github.com/aliirah/task-flow/services/search-service/internal/handler"
	"github.com/aliirah/task-flow/services/search-service/internal/reindexer"
	searchsvc "github.com/aliirah/task-flow/services/search-service/internal/search"
	"github.com/aliirah/task-flow/shared/env"
	log "github.com/aliirah/task-flow/shared/logging"
	"github.com/aliirah/task-flow/shared/messaging"
	"github.com/aliirah/task-flow/shared/metrics"
	searchpb "github.com/aliirah/task-flow/shared/proto/search/v1"
	taskpb "github.com/aliirah/task-flow/shared/proto/task/v1"
	userpb "github.com/aliirah/task-flow/shared/proto/user/v1"
	"github.com/aliirah/task-flow/shared/tracing"
)

func main() {
	loggerCfg := log.Config{
		Directory: env.GetString("LOG_DIR", "logs"),
		Filename:  env.GetString("LOG_FILE", "search-service"),
		Level:     env.GetString("LOG_LEVEL", "info"),
	}
	if _, err := log.Init(loggerCfg); err != nil {
		fmt.Fprintf(os.Stderr, "failed to initialise logger: %v\n", err)
		os.Exit(1)
	}
	defer log.Sync()

	tracerCfg := tracing.Config{
		ServiceName:    "search-service",
		Environment:    env.GetString("ENVIRONMENT", "development"),
		JaegerEndpoint: env.GetString("JAEGER_ENDPOINT", "http://jaeger:14268/api/traces"),
	}

	shutdown, err := tracing.InitTracer(tracerCfg)
	if err != nil {
		log.Error(fmt.Errorf("failed to init tracer: %w", err))
		os.Exit(1)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer func() {
		cancel()
		shutdown(context.Background())
	}()

	esURL := env.GetString("ELASTICSEARCH_URL", "http://elasticsearch:9200")
	searchService := searchsvc.NewService(esURL, env.GetString("SEARCH_INDEX_NAME", "taskflow_search"))
	if err := searchService.EnsureIndex(ctx); err != nil {
		log.Error(fmt.Errorf("failed to ensure index: %w", err))
		os.Exit(1)
	}

	rabbitURI := env.GetString("RABBITMQ_URI", "amqp://guest:guest@rabbitmq:5672/")
	rabbit, err := messaging.NewRabbitMQ(rabbitURI)
	if err != nil {
		log.Error(fmt.Errorf("failed to init rabbitmq: %w", err))
		os.Exit(1)
	}
	defer rabbit.Close()

	taskWrapper, userWrapper, err := dialGrpcClients(ctx)
	if err != nil {
		log.Error(fmt.Errorf("failed to dial grpc services: %w", err))
		os.Exit(1)
	}
	defer func() {
		if taskWrapper != nil && taskWrapper.conn != nil {
			taskWrapper.conn.Close()
		}
		if userWrapper != nil && userWrapper.conn != nil {
			userWrapper.conn.Close()
		}
	}()

	reindexerSvc := reindexer.New(searchService, taskWrapper.client, userWrapper.client)

	eventConsumer := consumer.New(rabbit, searchService)
	if err := eventConsumer.Start(); err != nil {
		log.Error(fmt.Errorf("failed to start consumers: %w", err))
		os.Exit(1)
	}

	grpcAddr := env.GetString("SEARCH_GRPC_ADDR", ":9091")
	lis, err := net.Listen("tcp", grpcAddr)
	if err != nil {
		log.Error(fmt.Errorf("failed to listen on %s: %w", grpcAddr, err))
		os.Exit(1)
	}

	grpcSrv := grpc.NewServer(
		grpc.StatsHandler(otelgrpc.NewServerHandler()),
		grpc.UnaryInterceptor(metrics.UnaryServerInterceptor()),
	)
	searchpb.RegisterSearchServiceServer(grpcSrv, grpcserver.New(searchService))

	go func() {
		log.Infof("Search gRPC server listening on %s", grpcAddr)
		if err := grpcSrv.Serve(lis); err != nil {
			log.Error(fmt.Errorf("grpc server stopped: %w", err))
			os.Exit(1)
		}
	}()

	router := gin.Default()
	router.Use(metrics.GinMiddleware("search-service"))
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	internalToken := env.GetString("SEARCH_INTERNAL_TOKEN", "")
	httpHandler := handler.New(searchService, reindexerSvc, internalToken)
	httpHandler.Register(router)
	router.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	httpAddr := env.GetString("HTTP_ADDR", ":8080")
	server := &http.Server{
		Addr:           httpAddr,
		Handler:        router,
		ReadTimeout:    10 * time.Second,
		WriteTimeout:   10 * time.Second,
		MaxHeaderBytes: 1 << 20,
	}

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Error(fmt.Errorf("search-service http server error: %w", err))
		os.Exit(1)
	}
}

type taskClientWrapper struct {
	client taskpb.TaskServiceClient
	conn   *grpc.ClientConn
}

type userClientWrapper struct {
	client userpb.UserServiceClient
	conn   *grpc.ClientConn
}

func dialGrpcClients(ctx context.Context) (*taskClientWrapper, *userClientWrapper, error) {
	dialOpts := []grpc.DialOption{
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithStatsHandler(otelgrpc.NewClientHandler()),
	}

	taskAddr := env.GetString("TASK_SERVICE_ADDR", "task-service:50054")
	userAddr := env.GetString("USER_SERVICE_ADDR", "user-service:50052")

	taskConn, err := grpc.DialContext(ctx, taskAddr, dialOpts...)
	if err != nil {
		return nil, nil, fmt.Errorf("dial task service: %w", err)
	}
	userConn, err := grpc.DialContext(ctx, userAddr, dialOpts...)
	if err != nil {
		taskConn.Close()
		return nil, nil, fmt.Errorf("dial user service: %w", err)
	}

	return &taskClientWrapper{
			client: taskpb.NewTaskServiceClient(taskConn),
			conn:   taskConn,
		}, &userClientWrapper{
			client: userpb.NewUserServiceClient(userConn),
			conn:   userConn,
		}, nil
}
