package seed

import (
	"log"
	"os"

	"github.com/aliirah/task-flow/services/auth-service/internal/models"
	"github.com/aliirah/task-flow/shared/db/gormdb"
	"github.com/aliirah/task-flow/shared/util/faker"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func Run() error {
	dsn := os.Getenv("AUTH_DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://auth_service:auth_service@localhost:5432/auth_service?sslmode=disable"
	}

	db, err := gormdb.Open(gormdb.Config{DSN: dsn})
	if err != nil {
		return err
	}

	if err := models.AutoMigrate(db); err != nil {
		return err
	}

	return seedAuthUsers(db, 5)
}

func seedAuthUsers(db *gorm.DB, count int) error {
	for i := 0; i < count; i++ {
		password := faker.Password()
		hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			return err
		}

		user := models.AuthUser{
			ID:           uuid.New(),
			Email:        faker.Email(),
			PasswordHash: string(hash),
			Status:       "active",
			UserType:     "user",
		}

		if err := db.Clauses(clause.OnConflict{DoNothing: true}).Create(&user).Error; err != nil {
			return err
		}

		log.Printf("seeded auth user: %s password:%s", user.Email, password)
	}
	return nil
}
