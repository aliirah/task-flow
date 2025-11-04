package main

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"os"
	"time"

	orgmodels "github.com/aliirah/task-flow/services/organization-service/internal/models"
	"github.com/aliirah/task-flow/shared/db/gormdb"
	userpb "github.com/aliirah/task-flow/shared/proto/user/v1"
	"github.com/aliirah/task-flow/shared/util/faker"
	"github.com/google/uuid"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"gorm.io/gorm"
)

func main() {
	rand.Seed(time.Now().UnixNano())

	orgDSN := os.Getenv("ORG_DATABASE_URL")
	if orgDSN == "" {
		orgDSN = "postgres://organization_service:organization_service@localhost:5432/organization_service?sslmode=disable"
	}

	db, err := gormdb.Open(gormdb.Config{DSN: orgDSN})
	if err != nil {
		log.Fatalf("connect org db: %v", err)
	}

	if err := orgmodels.AutoMigrate(db); err != nil {
		log.Fatalf("auto migrate: %v", err)
	}

	userIDs, err := fetchUserIDs()
	if err != nil {
		log.Fatalf("fetch users: %v", err)
	}
	if len(userIDs) < 2 {
		log.Fatalf("need at least two users to seed organizations, found %d", len(userIDs))
	}

	if err := seedOrganizations(db, userIDs, 3); err != nil {
		log.Fatalf("seed organizations: %v", err)
	}

	log.Println("organization-service seeding completed")
}

func fetchUserIDs() ([]string, error) {
	addr := os.Getenv("USER_SERVICE_ADDR")
	if addr == "" {
		addr = "user-service:50052"
	}

	timeout := 30 * time.Second
	if custom := os.Getenv("ORG_SEED_USER_TIMEOUT"); custom != "" {
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
	resp, err := client.ListUsers(ctx, &userpb.ListUsersRequest{Limit: 100})
	if err != nil {
		return nil, fmt.Errorf("list users via %s: %w", addr, err)
	}

	ids := make([]string, 0, len(resp.GetItems()))
	for _, u := range resp.GetItems() {
		if id := u.GetId(); id != "" {
			ids = append(ids, id)
		}
	}
	return ids, nil
}

func seedOrganizations(db *gorm.DB, userIDs []string, count int) error {
	for i := 0; i < count; i++ {
		ownerID := mustParse(selectRandom(userIDs))
		memberID := ownerID
		for attempts := 0; attempts < 5 && memberID == ownerID; attempts++ {
			memberID = mustParse(selectRandom(userIDs))
		}

		org := orgmodels.Organization{
			Name:        faker.Company(),
			Description: faker.Sentence(),
			OwnerID:     ownerID,
		}
		if err := db.Create(&org).Error; err != nil {
			return err
		}

		ownerMember := orgmodels.OrganizationMember{
			OrganizationID: org.ID,
			UserID:         ownerID,
			Role:           "owner",
			Status:         "active",
		}
		if err := db.Create(&ownerMember).Error; err != nil {
			return err
		}

		member := orgmodels.OrganizationMember{
			OrganizationID: org.ID,
			UserID:         memberID,
			Role:           "member",
			Status:         "active",
		}
		if err := db.Create(&member).Error; err != nil {
			return err
		}

		log.Printf("seeded organization: %s (owner %s, member %s)", org.Name, ownerID.String(), memberID.String())
	}
	return nil
}

func selectRandom(ids []string) string {
	return ids[rand.Intn(len(ids))]
}

func mustParse(id string) uuid.UUID {
	parsed, err := uuid.Parse(id)
	if err != nil {
		log.Fatalf("invalid user id %s: %v", id, err)
	}
	return parsed
}
