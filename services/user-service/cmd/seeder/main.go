package main

import (
	"log"
	"os"

	"github.com/aliirah/task-flow/services/user-service/internal/models"
	"github.com/aliirah/task-flow/shared/db/gormdb"
	"github.com/aliirah/task-flow/shared/util/faker"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func main() {
	dsn := os.Getenv("USER_DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://user_service:user_service@localhost:5432/user_service?sslmode=disable"
	}

	db, err := gormdb.Open(gormdb.Config{DSN: dsn})
	if err != nil {
		log.Fatalf("connect: %v", err)
	}

	if err := models.AutoMigrate(db); err != nil {
		log.Fatalf("auto migrate: %v", err)
	}

	if err := seedRoles(db); err != nil {
		log.Fatalf("seed roles: %v", err)
	}

	if err := seedUsers(db, 5); err != nil {
		log.Fatalf("seed users: %v", err)
	}

	log.Println("user-service seeding completed")
}

func seedRoles(db *gorm.DB) error {
	roles := []models.Role{
		{ID: uuid.New(), Name: "admin", Description: "Administrative user"},
		{ID: uuid.New(), Name: "user", Description: "Standard user"},
	}

	for _, role := range roles {
		if err := db.Clauses(clause.OnConflict{DoNothing: true}).Create(&role).Error; err != nil {
			return err
		}
		log.Printf("seeded role: %s", role.Name)
	}

	return nil
}

func seedUsers(db *gorm.DB, count int) error {
	for i := 0; i < count; i++ {
		user := models.User{
			ID:        uuid.New(),
			Email:     faker.Email(),
			FirstName: faker.FirstName(),
			LastName:  faker.LastName(),
			Status:    "active",
			UserType:  "user",
		}

		if err := db.Clauses(clause.OnConflict{DoNothing: true}).Create(&user).Error; err != nil {
			return err
		}
		log.Printf("seeded user profile: %s <%s>", user.FirstName, user.Email)
	}

	return nil
}
