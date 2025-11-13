package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"gorm.io/gorm"
)

type Comment struct {
	ID              uuid.UUID      `gorm:"type:uuid;primaryKey"`
	TaskID          uuid.UUID      `gorm:"type:uuid;not null;index"`
	UserID          uuid.UUID      `gorm:"type:uuid;not null;index"`
	ParentCommentID *uuid.UUID     `gorm:"type:uuid;index"`
	Content         string         `gorm:"type:text;not null"`
	MentionedUsers  pq.StringArray `gorm:"type:text[]"`
	CreatedAt       time.Time
	UpdatedAt       time.Time
	DeletedAt       gorm.DeletedAt `gorm:"index"`
	
	// Associations
	Task *Task `gorm:"foreignKey:TaskID"`
}

func (c *Comment) BeforeCreate(tx *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return nil
}
