package main

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"os"
	"time"

	"github.com/aliirah/task-flow/services/auth-service/internal/models"
	"github.com/aliirah/task-flow/shared/db/gormdb"
	userpb "github.com/aliirah/task-flow/shared/proto/user/v1"
	"github.com/aliirah/task-flow/shared/util/faker"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func main() {
	rand.Seed(time.Now().UnixNano())

	dsn := os.Getenv("AUTH_DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://auth_service:auth_service@localhost:5432/auth_service?sslmode=disable"
	}

	db, err := gormdb.Open(gormdb.Config{DSN: dsn})
	if err != nil {
		log.Fatalf("connect: %v", err)
	}

	if err := models.AutoMigrate(db); err != nil {
		log.Fatalf("auto migrate: %v", err)
	}

	users, err := fetchUsers()
	if err != nil {
		log.Fatalf("fetch users: %v", err)
	}
	if len(users) == 0 {
		log.Fatalf("no users available to seed auth records")
	}

	if err := seedAuthUsers(db, users, 5); err != nil {
		log.Fatalf("seed users: %v", err)
	}

	log.Println("auth-service seeding completed")
}

func fetchUsers() ([]*userpb.User, error) {
	addr := os.Getenv("USER_SERVICE_ADDR")
	if addr == "" {
		addr = "user-service:50052"
	}

	timeout := 30 * time.Second
	if custom := os.Getenv("AUTH_SEED_USER_TIMEOUT"); custom != "" {
		if parsed, err := time.ParseDuration(custom); err == nil {
			timeout = parsed
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
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

func seedAuthUsers(db *gorm.DB, users []*userpb.User, count int) error {
	for i := 0; i < count; i++ {
		selected := users[rand.Intn(len(users))]
		userID := selected.GetId()
		email := selected.GetEmail()
		if email == "" {
			email = faker.Email()
		}

		password := faker.Password()
		hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			return err
		}

		user := models.AuthUser{
			ID:           mustParse(userID),
			Email:        email,
			PasswordHash: string(hash),
			Status:       "active",
			UserType:     "user",
		}

		if err := db.Clauses(clause.OnConflict{DoNothing: true}).Create(&user).Error; err != nil {
			return err
		}

		log.Printf("seeded auth user: %s (id %s) password:%s", user.Email, user.ID.String(), password)
	}
	return nil
}

func mustParse(id string) uuid.UUID {
	parsed, err := uuid.Parse(id)
	if err != nil {
		log.Fatalf("invalid uuid %s: %v", id, err)
	}
	return parsed
}
