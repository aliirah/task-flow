package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Task struct {
	ID             uuid.UUID `gorm:"type:uuid;primaryKey"`
	Title          string    `gorm:"not null"`
	Description    string    `gorm:"type:text"`
	Status         string    `gorm:"not null;default:open"`
	Priority       string    `gorm:"not null;default:medium"`
	OrganizationID uuid.UUID `gorm:"type:uuid;index"`
	AssigneeID     uuid.UUID `gorm:"type:uuid;index"`
	ReporterID     uuid.UUID `gorm:"type:uuid;index"`
	DueAt          *time.Time
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

func (t *Task) BeforeCreate(tx *gorm.DB) error {
	if t.ID == uuid.Nil {
		t.ID = uuid.New()
	}
	return nil
}

func AutoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(&Task{}, &Comment{})
}
