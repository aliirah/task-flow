package service

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

type NotificationService interface {
	CreateNotification(ctx context.Context, notification *models.Notification) error
	ListNotifications(ctx context.Context, params ListParams) ([]models.Notification, int64, bool, error)
	MarkAsRead(ctx context.Context, id, userID uuid.UUID) error
	MarkAllAsRead(ctx context.Context, userID uuid.UUID) (int64, error)
	DeleteNotification(ctx context.Context, id, userID uuid.UUID) error
	GetUnreadCount(ctx context.Context, userID uuid.UUID) (int64, error)
}

type notificationService struct {
	db *gorm.DB
}

func NewNotificationService(db *gorm.DB) NotificationService {
	return &notificationService{db: db}
}

func (s *notificationService) CreateNotification(ctx context.Context, notification *models.Notification) error {
	return s.db.WithContext(ctx).Create(notification).Error
}

func (s *notificationService) ListNotifications(ctx context.Context, params ListParams) ([]models.Notification, int64, bool, error) {
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

	query := s.db.WithContext(ctx).
		Model(&models.Notification{}).
		Where("user_id = ?", params.UserID)

	if params.UnreadOnly {
		query = query.Where("is_read = ?", false)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, false, err
	}

	var notifications []models.Notification
	err := query.
		Order("created_at DESC").
		Offset(offset).
		Limit(params.Limit).
		Find(&notifications).Error
	if err != nil {
		return nil, 0, false, err
	}

	hasMore := int64(params.Page*params.Limit) < total
	return notifications, total, hasMore, nil
}

func (s *notificationService) MarkAsRead(ctx context.Context, id, userID uuid.UUID) error {
	now := time.Now()
	return s.db.WithContext(ctx).
		Model(&models.Notification{}).
		Where("id = ? AND user_id = ?", id, userID).
		Updates(map[string]interface{}{
			"is_read": true,
			"read_at": now,
		}).Error
}

func (s *notificationService) MarkAllAsRead(ctx context.Context, userID uuid.UUID) (int64, error) {
	now := time.Now()
	result := s.db.WithContext(ctx).
		Model(&models.Notification{}).
		Where("user_id = ? AND is_read = ?", userID, false).
		Updates(map[string]interface{}{
			"is_read": true,
			"read_at": now,
		})

	return result.RowsAffected, result.Error
}

func (s *notificationService) DeleteNotification(ctx context.Context, id, userID uuid.UUID) error {
	return s.db.WithContext(ctx).
		Where("id = ? AND user_id = ?", id, userID).
		Delete(&models.Notification{}).Error
}

func (s *notificationService) GetUnreadCount(ctx context.Context, userID uuid.UUID) (int64, error) {
	var count int64
	err := s.db.WithContext(ctx).
		Model(&models.Notification{}).
		Where("user_id = ? AND is_read = ?", userID, false).
		Count(&count).Error

	return count, err
}
