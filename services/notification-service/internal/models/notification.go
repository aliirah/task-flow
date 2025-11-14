package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"gorm.io/gorm"
)

// NotificationType defines the type of notification
type NotificationType string

const (
	NotificationTypeTaskCreated      NotificationType = "task_created"
	NotificationTypeTaskUpdated      NotificationType = "task_updated"
	NotificationTypeTaskDeleted      NotificationType = "task_deleted"
	NotificationTypeCommentCreated   NotificationType = "comment_created"
	NotificationTypeCommentUpdated   NotificationType = "comment_updated"
	NotificationTypeCommentDeleted   NotificationType = "comment_deleted"
	NotificationTypeCommentMentioned NotificationType = "comment_mentioned"
)

// Notification represents a user notification
type Notification struct {
	ID             uuid.UUID        `gorm:"type:uuid;primaryKey"`
	UserID         uuid.UUID        `gorm:"type:uuid;not null;index:idx_user_read,priority:1"`
	OrganizationID uuid.UUID        `gorm:"type:uuid;not null;index"`
	TriggerUserID  uuid.UUID        `gorm:"type:uuid;not null"` // Who triggered the action
	Type           NotificationType `gorm:"type:varchar(50);not null;index"`
	EntityType     string           `gorm:"type:varchar(50);not null"` // task, comment
	EntityID       uuid.UUID        `gorm:"type:uuid;not null"`
	Title          string           `gorm:"type:varchar(255);not null"`
	Message        string           `gorm:"type:text"`
	URL            string           `gorm:"type:varchar(500)"` // Navigation URL for frontend
	Data           pq.StringArray   `gorm:"type:jsonb"`        // Additional metadata as JSON
	IsRead         bool             `gorm:"default:false;index:idx_user_read,priority:2"`
	ReadAt         *time.Time
	CreatedAt      time.Time `gorm:"index"`
	UpdatedAt      time.Time
	DeletedAt      gorm.DeletedAt `gorm:"index"`
}

func (n *Notification) BeforeCreate(tx *gorm.DB) error {
	if n.ID == uuid.Nil {
		n.ID = uuid.New()
	}
	return nil
}

// TableName specifies the table name for Notification
func (Notification) TableName() string {
	return "notifications"
}
