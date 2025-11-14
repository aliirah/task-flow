package service

import (
	"context"

	"github.com/aliirah/task-flow/services/notification-service/internal/models"
	"github.com/aliirah/task-flow/services/notification-service/internal/repository"
	"github.com/google/uuid"
)

type NotificationService interface {
	CreateNotification(ctx context.Context, notification *models.Notification) error
	ListNotifications(ctx context.Context, params repository.ListParams) ([]models.Notification, int64, bool, error)
	MarkAsRead(ctx context.Context, id, userID uuid.UUID) error
	MarkAllAsRead(ctx context.Context, userID uuid.UUID) (int64, error)
	DeleteNotification(ctx context.Context, id, userID uuid.UUID) error
	GetUnreadCount(ctx context.Context, userID uuid.UUID) (int64, error)
}

type notificationService struct {
	repo repository.NotificationRepository
}

func NewNotificationService(repo repository.NotificationRepository) NotificationService {
	return &notificationService{repo: repo}
}

func (s *notificationService) CreateNotification(ctx context.Context, notification *models.Notification) error {
	return s.repo.Create(ctx, notification)
}

func (s *notificationService) ListNotifications(ctx context.Context, params repository.ListParams) ([]models.Notification, int64, bool, error) {
	notifications, total, err := s.repo.List(ctx, params)
	if err != nil {
		return nil, 0, false, err
	}

	hasMore := int64(params.Page*params.Limit) < total

	return notifications, total, hasMore, nil
}

func (s *notificationService) MarkAsRead(ctx context.Context, id, userID uuid.UUID) error {
	return s.repo.MarkAsRead(ctx, id, userID)
}

func (s *notificationService) MarkAllAsRead(ctx context.Context, userID uuid.UUID) (int64, error) {
	return s.repo.MarkAllAsRead(ctx, userID)
}

func (s *notificationService) DeleteNotification(ctx context.Context, id, userID uuid.UUID) error {
	return s.repo.Delete(ctx, id, userID)
}

func (s *notificationService) GetUnreadCount(ctx context.Context, userID uuid.UUID) (int64, error) {
	return s.repo.GetUnreadCount(ctx, userID)
}
