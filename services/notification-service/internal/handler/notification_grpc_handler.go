package handler

import (
	"context"

	"github.com/aliirah/task-flow/services/notification-service/internal/models"
	"github.com/aliirah/task-flow/services/notification-service/internal/repository"
	"github.com/aliirah/task-flow/services/notification-service/internal/service"
	notificationpb "github.com/aliirah/task-flow/shared/proto/notification/v1"
	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type NotificationHandler struct {
	notificationpb.UnimplementedNotificationServiceServer
	service service.NotificationService
}

func NewNotificationHandler(svc service.NotificationService) *NotificationHandler {
	return &NotificationHandler{
		service: svc,
	}
}

func (h *NotificationHandler) ListNotifications(ctx context.Context, req *notificationpb.ListNotificationsRequest) (*notificationpb.ListNotificationsResponse, error) {
	// Get user ID from context (should be set by auth middleware)
	userID, err := getUserIDFromContext(ctx)
	if err != nil {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	params := repository.ListParams{
		UserID:     userID,
		Page:       int(req.GetPage()),
		Limit:      int(req.GetLimit()),
		UnreadOnly: req.GetUnreadOnly(),
	}

	notifications, total, hasMore, err := h.service.ListNotifications(ctx, params)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	items := make([]*notificationpb.Notification, 0, len(notifications))
	for _, n := range notifications {
		items = append(items, toProtoNotification(&n))
	}

	return &notificationpb.ListNotificationsResponse{
		Items:   items,
		Total:   int32(total),
		HasMore: hasMore,
	}, nil
}

func (h *NotificationHandler) MarkAsRead(ctx context.Context, req *notificationpb.MarkAsReadRequest) (*emptypb.Empty, error) {
	userID, err := getUserIDFromContext(ctx)
	if err != nil {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	notificationID, err := uuid.Parse(req.GetId())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "invalid notification ID")
	}

	if err := h.service.MarkAsRead(ctx, notificationID, userID); err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return &emptypb.Empty{}, nil
}

func (h *NotificationHandler) MarkAllAsRead(ctx context.Context, req *notificationpb.MarkAllAsReadRequest) (*notificationpb.MarkAllAsReadResponse, error) {
	userID, err := getUserIDFromContext(ctx)
	if err != nil {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	count, err := h.service.MarkAllAsRead(ctx, userID)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return &notificationpb.MarkAllAsReadResponse{
		Count: int32(count),
	}, nil
}

func (h *NotificationHandler) DeleteNotification(ctx context.Context, req *notificationpb.DeleteNotificationRequest) (*emptypb.Empty, error) {
	userID, err := getUserIDFromContext(ctx)
	if err != nil {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	notificationID, err := uuid.Parse(req.GetId())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "invalid notification ID")
	}

	if err := h.service.DeleteNotification(ctx, notificationID, userID); err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return &emptypb.Empty{}, nil
}

func (h *NotificationHandler) GetUnreadCount(ctx context.Context, req *notificationpb.GetUnreadCountRequest) (*notificationpb.GetUnreadCountResponse, error) {
	userID, err := getUserIDFromContext(ctx)
	if err != nil {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	count, err := h.service.GetUnreadCount(ctx, userID)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return &notificationpb.GetUnreadCountResponse{
		Count: int32(count),
	}, nil
}

func getUserIDFromContext(ctx context.Context) (uuid.UUID, error) {
	// This should extract user ID from the context
	// You'll need to implement this based on your auth setup
	// For now, returning a placeholder error
	// TODO: Implement proper user ID extraction from context
	return uuid.Nil, status.Error(codes.Unimplemented, "getUserIDFromContext not implemented")
}

func toProtoNotification(n *models.Notification) *notificationpb.Notification {
	proto := &notificationpb.Notification{
		Id:             n.ID.String(),
		UserId:         n.UserID.String(),
		OrganizationId: n.OrganizationID.String(),
		TriggerUserId:  n.TriggerUserID.String(),
		Type:           string(n.Type),
		EntityType:     n.EntityType,
		EntityId:       n.EntityID.String(),
		Title:          n.Title,
		Message:        n.Message,
		Url:            n.URL,
		IsRead:         n.IsRead,
		CreatedAt:      timestamppb.New(n.CreatedAt),
		UpdatedAt:      timestamppb.New(n.UpdatedAt),
	}

	if n.ReadAt != nil {
		proto.ReadAt = timestamppb.New(*n.ReadAt)
	}

	// TODO: Serialize n.Data to JSON string if needed
	// proto.Data = ...

	return proto
}
