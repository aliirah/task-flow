package seed

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

func Run() error {
	dsn := os.Getenv("USER_DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://user_service:user_service@user-db:5432/user_service?sslmode=disable"
	}

	db, err := gormdb.Open(gormdb.Config{DSN: dsn})
	if err != nil {
		return err
	}

	if err := models.AutoMigrate(db); err != nil {
		return err
	}

	if err := seedRoles(db); err != nil {
		return err
	}

	return seedUsers(db, 5)
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
