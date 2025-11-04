package main

import (
	"log"
	"os"

	"github.com/aliirah/task-flow/services/organization-service/internal/models"
	"github.com/aliirah/task-flow/shared/db/gormdb"
	"github.com/aliirah/task-flow/shared/util/faker"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func main() {
	dsn := os.Getenv("ORG_DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://organization_service:organization_service@localhost:5432/organization_service?sslmode=disable"
	}

	db, err := gormdb.Open(gormdb.Config{DSN: dsn})
	if err != nil {
		log.Fatalf("connect: %v", err)
	}

	if err := models.AutoMigrate(db); err != nil {
		log.Fatalf("auto migrate: %v", err)
	}

	if err := seedOrganizations(db, 3); err != nil {
		log.Fatalf("seed organizations: %v", err)
	}

	log.Println("organization-service seeding completed")
}

func seedOrganizations(db *gorm.DB, count int) error {
	for i := 0; i < count; i++ {
		ownerID := uuid.New()
		org := models.Organization{
			Name:        faker.Company(),
			Description: faker.Sentence(),
			OwnerID:     ownerID,
		}
		if err := db.Create(&org).Error; err != nil {
			return err
		}

		ownerMember := models.OrganizationMember{
			OrganizationID: org.ID,
			UserID:         ownerID,
			Role:           "owner",
			Status:         "active",
		}
		if err := db.Create(&ownerMember).Error; err != nil {
			return err
		}

		// add a collaborator
		member := models.OrganizationMember{
			OrganizationID: org.ID,
			UserID:         uuid.New(),
			Role:           "member",
			Status:         "active",
		}
		if err := db.Create(&member).Error; err != nil {
			return err
		}

		log.Printf("seeded organization: %s (owner %s)\n", org.Name, ownerID.String())
	}
	return nil
}
