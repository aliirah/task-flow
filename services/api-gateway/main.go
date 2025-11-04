package main

import (
	"context"
	"log"
	"net/http"
	"time"

	grpcclient "github.com/aliirah/task-flow/services/api-gateway/internal/handler/grpc"
	httphandler "github.com/aliirah/task-flow/services/api-gateway/internal/handler/http"
	gatewaymiddleware "github.com/aliirah/task-flow/services/api-gateway/internal/middleware"
	gatewayservice "github.com/aliirah/task-flow/services/api-gateway/internal/service"
	"github.com/aliirah/task-flow/services/api-gateway/routes"
	"github.com/aliirah/task-flow/shared/env"
	"github.com/aliirah/task-flow/shared/messaging"
	"github.com/aliirah/task-flow/shared/tracing"
	"github.com/gin-gonic/gin"
)

var (
	httpAddr    = env.GetString("HTTP_ADDR", ":8081")
	rabbitMqURI = env.GetString("RABBITMQ_URI", "amqp://guest:guest@rabbitmq:5672/")
)

func main() {
	log.Println("Starting API Gateway")

	// init tracing
	tracerCfg := tracing.Config{
		ServiceName:    "api-gateway",
		Environment:    env.GetString("ENVIRONMENT", "development"),
		JaegerEndpoint: env.GetString("JAEGER_ENDPOINT", "http://jaeger:14268/api/traces"),
	}

	sh, err := tracing.InitTracer(tracerCfg)
	if err != nil {
		log.Fatalf("failed to initialize tracer: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	defer sh(ctx)

	// gRPC connections
	authAddr := env.GetString("AUTH_SERVICE_ADDR", "auth-service:50051")
	userAddr := env.GetString("USER_SERVICE_ADDR", "user-service:50052")

	grpcClients, err := grpcclient.Dial(ctx, grpcclient.Config{
		AuthAddr: authAddr,
		UserAddr: userAddr,
	})
	if err != nil {
		log.Fatalf("failed to connect downstream services: %v", err)
	}
	defer grpcClients.Close()

	// RabbitMQ connection
	rabbitmq, err := messaging.NewRabbitMQ(rabbitMqURI)
	if err != nil {
		log.Fatal(err)
	}
	defer rabbitmq.Close()

	router := gin.Default()
	router.Use(gatewaymiddleware.HTTPTracing())
	healthHandler := httphandler.NewHealthHandler(gatewayservice.NewHealthService())
	authHandler := httphandler.NewAuthHandler(gatewayservice.NewAuthService(grpcClients.Auth))
	userHandler := httphandler.NewUserHandler(gatewayservice.NewUserService(grpcClients.User))

	routes.Register(router, routes.Dependencies{
		Health: healthHandler,
		Auth:   authHandler,
		User:   userHandler,
	})
	s := &http.Server{
		Addr:           httpAddr,
		Handler:        router,
		ReadTimeout:    10 * time.Second,
		WriteTimeout:   10 * time.Second,
		MaxHeaderBytes: 1 << 20,
	}
	s.ListenAndServe()
}
