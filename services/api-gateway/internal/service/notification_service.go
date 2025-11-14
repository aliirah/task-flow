package service

import (
	"context"

	notificationpb "github.com/aliirah/task-flow/shared/proto/notification/v1"
)

type Notification = notificationpb.Notification

type NotificationFilter struct {
	UserID string
	IsRead *bool
	Page   int
	Limit  int
}

type NotificationService interface {
	List(ctx context.Context, filter NotificationFilter) ([]*Notification, error)
	GetUnreadCount(ctx context.Context, userID string) (int32, error)
	MarkAsRead(ctx context.Context, userID string, notificationID string) error
	MarkAllAsRead(ctx context.Context, userID string) error
	Delete(ctx context.Context, userID string, notificationID string) error
}

type notificationService struct {
	client notificationpb.NotificationServiceClient
}

func NewNotificationService(client notificationpb.NotificationServiceClient) NotificationService {
	return &notificationService{client: client}
}

func (s *notificationService) List(ctx context.Context, filter NotificationFilter) ([]*Notification, error) {
	req := &notificationpb.ListNotificationsRequest{
		Page:  int32(filter.Page),
		Limit: int32(filter.Limit),
	}
	
	if filter.IsRead != nil && !*filter.IsRead {
		req.UnreadOnly = true
	}

	resp, err := s.client.ListNotifications(ctx, req)
	if err != nil {
		return nil, err
	}

	return resp.Items, nil
}

func (s *notificationService) GetUnreadCount(ctx context.Context, userID string) (int32, error) {
	resp, err := s.client.GetUnreadCount(ctx, &notificationpb.GetUnreadCountRequest{})
	if err != nil {
		return 0, err
	}

	return resp.Count, nil
}

func (s *notificationService) MarkAsRead(ctx context.Context, userID string, notificationID string) error {
	_, err := s.client.MarkAsRead(ctx, &notificationpb.MarkAsReadRequest{
		Id: notificationID,
	})
	return err
}

func (s *notificationService) MarkAllAsRead(ctx context.Context, userID string) error {
	_, err := s.client.MarkAllAsRead(ctx, &notificationpb.MarkAllAsReadRequest{})
	return err
}

func (s *notificationService) Delete(ctx context.Context, userID string, notificationID string) error {
	_, err := s.client.DeleteNotification(ctx, &notificationpb.DeleteNotificationRequest{
		Id: notificationID,
	})
	return err
}
