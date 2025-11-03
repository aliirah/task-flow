package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/aliirah/task-flow/services/api-gateway/middleware"
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

	// RabbitMQ connection
	rabbitmq, err := messaging.NewRabbitMQ(rabbitMqURI)
	if err != nil {
		log.Fatal(err)
	}
	defer rabbitmq.Close()

	router := gin.Default()
	router.Use(middleware.HTTPTracing())
	routes.Register(router)
	s := &http.Server{
		Addr:           httpAddr,
		Handler:        router,
		ReadTimeout:    10 * time.Second,
		WriteTimeout:   10 * time.Second,
		MaxHeaderBytes: 1 << 20,
	}
	s.ListenAndServe()
}
