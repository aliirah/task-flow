package repository

import (
	"context"
	"time"

	"github.com/aliirah/task-flow/services/notification-service/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ListParams struct {
	UserID     uuid.UUID
	Page       int
	Limit      int
	UnreadOnly bool
}

type NotificationRepository interface {
	Create(ctx context.Context, notification *models.Notification) error
	List(ctx context.Context, params ListParams) ([]models.Notification, int64, error)
	MarkAsRead(ctx context.Context, id, userID uuid.UUID) error
	MarkAllAsRead(ctx context.Context, userID uuid.UUID) (int64, error)
	Delete(ctx context.Context, id, userID uuid.UUID) error
	GetUnreadCount(ctx context.Context, userID uuid.UUID) (int64, error)
}

type notificationRepository struct {
	db *gorm.DB
}

func NewNotificationRepository(db *gorm.DB) NotificationRepository {
	return &notificationRepository{db: db}
}

func (r *notificationRepository) Create(ctx context.Context, notification *models.Notification) error {
	return r.db.WithContext(ctx).Create(notification).Error
}

func (r *notificationRepository) List(ctx context.Context, params ListParams) ([]models.Notification, int64, error) {
	if params.Page <= 0 {
		params.Page = 1
	}
	if params.Limit <= 0 {
		params.Limit = 20
	}
	if params.Limit > 100 {
		params.Limit = 100
	}

	offset := (params.Page - 1) * params.Limit

	query := r.db.WithContext(ctx).
		Model(&models.Notification{}).
		Where("user_id = ?", params.UserID)

	if params.UnreadOnly {
		query = query.Where("is_read = ?", false)
	}

	// Get total count
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// Get notifications
	var notifications []models.Notification
	err := query.
		Order("created_at DESC").
		Offset(offset).
		Limit(params.Limit).
		Find(&notifications).Error

	return notifications, total, err
}

func (r *notificationRepository) MarkAsRead(ctx context.Context, id, userID uuid.UUID) error {
	now := time.Now()
	return r.db.WithContext(ctx).
		Model(&models.Notification{}).
		Where("id = ? AND user_id = ?", id, userID).
		Updates(map[string]interface{}{
			"is_read": true,
			"read_at": now,
		}).Error
}

func (r *notificationRepository) MarkAllAsRead(ctx context.Context, userID uuid.UUID) (int64, error) {
	now := time.Now()
	result := r.db.WithContext(ctx).
		Model(&models.Notification{}).
		Where("user_id = ? AND is_read = ?", userID, false).
		Updates(map[string]interface{}{
			"is_read": true,
			"read_at": now,
		})

	return result.RowsAffected, result.Error
}

func (r *notificationRepository) Delete(ctx context.Context, id, userID uuid.UUID) error {
	return r.db.WithContext(ctx).
		Where("id = ? AND user_id = ?", id, userID).
		Delete(&models.Notification{}).Error
}

func (r *notificationRepository) GetUnreadCount(ctx context.Context, userID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&models.Notification{}).
		Where("user_id = ? AND is_read = ?", userID, false).
		Count(&count).Error

	return count, err
}
