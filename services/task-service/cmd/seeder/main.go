package main

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"os"
	"time"

	taskmodels "github.com/aliirah/task-flow/services/task-service/internal/models"
	"github.com/aliirah/task-flow/shared/db/gormdb"
	orgpb "github.com/aliirah/task-flow/shared/proto/organization/v1"
	userpb "github.com/aliirah/task-flow/shared/proto/user/v1"
	"github.com/aliirah/task-flow/shared/util/faker"
	"github.com/google/uuid"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"gorm.io/gorm"
)

func main() {
	rand.Seed(time.Now().UnixNano())

	dsn := os.Getenv("TASK_DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://task_service:task_service@localhost:5432/task_service?sslmode=disable"
	}

	db, err := gormdb.Open(gormdb.Config{DSN: dsn})
	if err != nil {
		log.Fatalf("connect task db: %v", err)
	}

	if err := taskmodels.AutoMigrate(db); err != nil {
		log.Fatalf("auto migrate: %v", err)
	}

	users, err := fetchUsers()
	if err != nil {
		log.Fatalf("fetch users: %v", err)
	}
	if len(users) == 0 {
		log.Fatalf("no users available for task seeding")
	}

	orgs, err := fetchOrganizations()
	if err != nil {
		log.Fatalf("fetch organizations: %v", err)
	}
	if len(orgs) == 0 {
		log.Fatalf("no organizations available for task seeding")
	}

	if err := seedTasks(db, users, orgs, 5); err != nil {
		log.Fatalf("seed tasks: %v", err)
	}

	log.Println("task-service seeding completed")
}

func fetchUsers() ([]*userpb.User, error) {
	addr := os.Getenv("USER_SERVICE_ADDR")
	if addr == "" {
		addr = "user-service:50052"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	conn, err := grpc.DialContext(ctx, addr, grpc.WithTransportCredentials(insecure.NewCredentials()), grpc.WithBlock())
	if err != nil {
		return nil, fmt.Errorf("dial user service %s: %w", addr, err)
	}
	defer conn.Close()

	client := userpb.NewUserServiceClient(conn)
	resp, err := client.ListUsers(ctx, &userpb.ListUsersRequest{Limit: 200})
	if err != nil {
		return nil, fmt.Errorf("list users via %s: %w", addr, err)
	}

	users := make([]*userpb.User, 0, len(resp.GetItems()))
	for _, u := range resp.GetItems() {
		if u.GetId() != "" {
			users = append(users, u)
		}
	}
	return users, nil
}

func fetchOrganizations() ([]*orgpb.Organization, error) {
	addr := os.Getenv("ORG_SERVICE_ADDR")
	if addr == "" {
		addr = "organization-service:50053"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	conn, err := grpc.DialContext(ctx, addr, grpc.WithTransportCredentials(insecure.NewCredentials()), grpc.WithBlock())
	if err != nil {
		return nil, fmt.Errorf("dial organization service %s: %w", addr, err)
	}
	defer conn.Close()

	client := orgpb.NewOrganizationServiceClient(conn)
	resp, err := client.ListOrganizations(ctx, &orgpb.ListOrganizationsRequest{Limit: 200})
	if err != nil {
		return nil, fmt.Errorf("list organizations via %s: %w", addr, err)
	}

	orgs := make([]*orgpb.Organization, 0, len(resp.GetItems()))
	for _, o := range resp.GetItems() {
		if o.GetId() != "" {
			orgs = append(orgs, o)
		}
	}
	return orgs, nil
}

func seedTasks(db *gorm.DB, users []*userpb.User, orgs []*orgpb.Organization, count int) error {
	for i := 0; i < count; i++ {
		org := orgs[rand.Intn(len(orgs))]
		assignee := users[rand.Intn(len(users))]
		reporter := users[rand.Intn(len(users))]

		dueDate := time.Now().Add(time.Duration(rand.Intn(240)) * time.Hour)

		task := taskmodels.Task{
			Title:          faker.Sentence(),
			Description:    faker.Sentence(),
			Status:         randomChoice([]string{"open", "in_progress", "completed"}),
			Priority:       randomChoice([]string{"low", "medium", "high"}),
			OrganizationID: mustParse(org.GetId()),
			AssigneeID:     mustParse(assignee.GetId()),
			ReporterID:     mustParse(reporter.GetId()),
			DueAt:          &dueDate,
		}
		if err := db.Create(&task).Error; err != nil {
			return err
		}

		log.Printf("seeded task: %s for org %s (assignee %s reporter %s)", task.Title, org.GetId(), assignee.GetId(), reporter.GetId())
	}
	return nil
}

func randomChoice(options []string) string {
	return options[rand.Intn(len(options))]
}

func mustParse(id string) uuid.UUID {
	parsed, err := uuid.Parse(id)
	if err != nil {
		log.Fatalf("invalid uuid %s: %v", id, err)
	}
	return parsed
}
