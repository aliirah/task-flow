package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"os"
	"os/signal"
	"syscall"

	"github.com/aliirah/task-flow/services/notification-service/internal/event"
	"github.com/aliirah/task-flow/services/notification-service/internal/handler"
	"github.com/aliirah/task-flow/services/notification-service/internal/models"
	"github.com/aliirah/task-flow/services/notification-service/internal/repository"
	"github.com/aliirah/task-flow/services/notification-service/internal/service"
	"github.com/aliirah/task-flow/shared/env"
	"github.com/aliirah/task-flow/shared/messaging"
	notificationpb "github.com/aliirah/task-flow/shared/proto/notification/v1"
	"google.golang.org/grpc"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	if err := run(); err != nil {
		log.Fatalf("Failed to run notification service: %v", err)
	}
}

func run() error {
	// Load environment variables
	dbURL := env.GetString("DATABASE_URL", "")
	if dbURL == "" {
		return fmt.Errorf("DATABASE_URL is required")
	}

	rabbitMQURL := env.GetString("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
	grpcPort := env.GetString("GRPC_PORT", "50055")

	// Initialize database
	db, err := gorm.Open(postgres.Open(dbURL), &gorm.Config{})
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	// Auto migrate
	if err := db.AutoMigrate(&models.Notification{}); err != nil {
		return fmt.Errorf("failed to migrate database: %w", err)
	}

	log.Println("Database connected and migrated")

	// Initialize RabbitMQ connection
	rabbitMQ, err := messaging.NewRabbitMQ(rabbitMQURL)
	if err != nil {
		return fmt.Errorf("failed to connect to RabbitMQ: %w", err)
	}
	defer rabbitMQ.Close()

	log.Println("RabbitMQ connected")

	// Initialize repository and service
	repo := repository.NewNotificationRepository(db)
	svc := service.NewNotificationService(repo)

	// Start gRPC server
	lis, err := net.Listen("tcp", ":"+grpcPort)
	if err != nil {
		return fmt.Errorf("failed to listen: %w", err)
	}

	grpcServer := grpc.NewServer()
	notificationpb.RegisterNotificationServiceServer(grpcServer, handler.NewNotificationHandler(svc))

	log.Printf("gRPC server listening on :%s", grpcPort)

	// Start consumer in a goroutine
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	consumer := event.NewNotificationConsumer(rabbitMQ, svc)
	go func() {
		if err := consumer.Start(ctx); err != nil {
			log.Printf("Consumer error: %v", err)
		}
	}()

	// Handle graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-sigChan
		log.Println("Shutting down gracefully...")
		cancel()
		grpcServer.GracefulStop()
	}()

	// Start serving
	if err := grpcServer.Serve(lis); err != nil {
		return fmt.Errorf("failed to serve: %w", err)
	}

	return nil
}
