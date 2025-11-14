package event

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/aliirah/task-flow/shared/contracts"
	"github.com/aliirah/task-flow/shared/messaging"
	notificationpb "github.com/aliirah/task-flow/shared/proto/notification/v1"
	amqp "github.com/rabbitmq/amqp091-go"
)

type NotificationConsumer struct {
	rabbitmq   *messaging.RabbitMQ
	connMgr    *messaging.ConnectionManager
	notifSvc   notificationpb.NotificationServiceClient
}

func NewNotificationConsumer(rabbitmq *messaging.RabbitMQ, connMgr *messaging.ConnectionManager, notifSvc notificationpb.NotificationServiceClient) *NotificationConsumer {
	return &NotificationConsumer{
		rabbitmq: rabbitmq,
		connMgr:  connMgr,
		notifSvc: notifSvc,
	}
}

func (c *NotificationConsumer) Listen() error {
	return c.rabbitmq.ConsumeMessages(messaging.NotificationsQueue, c.handle)
}

func (c *NotificationConsumer) handle(ctx context.Context, msg amqp.Delivery) error {
	fmt.Printf("[NotificationConsumer] Received message with routing key: %s\n", msg.RoutingKey)

	var notifEvent contracts.NotificationEvent
	if err := json.Unmarshal(msg.Body, &notifEvent); err != nil {
		fmt.Printf("[NotificationConsumer] Failed to unmarshal notification event: %v\n", err)
		return fmt.Errorf("failed to unmarshal notification event: %w", err)
	}

	fmt.Printf("[NotificationConsumer] Processing notification event - Type: %s, OrgID: %s, Recipients: %v\n", 
		notifEvent.EventType, notifEvent.OrganizationID, notifEvent.Recipients)

	// Fetch the latest notifications for each recipient
	for _, recipientID := range notifEvent.Recipients {
		// Query notification service for the user's latest notification
		resp, err := c.notifSvc.ListNotifications(ctx, &notificationpb.ListNotificationsRequest{
			Page:  1,
			Limit: 1, // Get the most recent notification
		})
		if err != nil {
			fmt.Printf("[NotificationConsumer] Failed to fetch notifications for user %s: %v\n", recipientID, err)
			continue
		}

		if len(resp.Items) == 0 {
			fmt.Printf("[NotificationConsumer] No notifications found for user %s\n", recipientID)
			continue
		}

		notification := resp.Items[0]

		// Create WebSocket message with camelCase fields
		wsMsg := contracts.WSMessage{
			Type: "notification.created",
			Data: map[string]interface{}{
				"id":         notification.Id,
				"type":       notification.Type,
				"title":      notification.Title,
				"message":    notification.Message,
				"entityType": notification.EntityType,
				"entityId":   notification.EntityId,
				"url":        notification.Url,
				"isRead":     notification.IsRead,
				"createdAt":  notification.CreatedAt.AsTime().Format("2006-01-02T15:04:05Z07:00"),
			},
		}

		fmt.Printf("[NotificationConsumer] Sending WebSocket notification to user %s: isRead=%v\n", recipientID, notification.IsRead)

		// Send to specific user
		if err := c.connMgr.SendToUser(recipientID, wsMsg); err != nil {
			fmt.Printf("[NotificationConsumer] Failed to send notification to user %s: %v\n", recipientID, err)
			continue
		}

		fmt.Printf("[NotificationConsumer] Successfully sent notification to user %s\n", recipientID)
	}

	return nil
}
