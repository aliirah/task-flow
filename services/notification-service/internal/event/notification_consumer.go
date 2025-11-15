package event

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/aliirah/task-flow/services/notification-service/internal/models"
	"github.com/aliirah/task-flow/services/notification-service/internal/service"
	"github.com/aliirah/task-flow/shared/contracts"
	"github.com/aliirah/task-flow/shared/messaging"
	"github.com/google/uuid"
	amqp "github.com/rabbitmq/amqp091-go"
)

type NotificationConsumer struct {
	rmq     *messaging.RabbitMQ
	service service.NotificationService
}

func NewNotificationConsumer(rmq *messaging.RabbitMQ, svc service.NotificationService) *NotificationConsumer {
	return &NotificationConsumer{
		rmq:     rmq,
		service: svc,
	}
}

func (c *NotificationConsumer) Start(ctx context.Context) error {
	if c.rmq == nil || c.rmq.Channel == nil {
		return fmt.Errorf("rabbitmq connection not initialized")
	}
	
	ch := c.rmq.Channel

	// Queue is already declared and bound in shared/messaging/rabbitmq.go setup
	// Just start consuming from it

	msgs, err := ch.Consume(
		messaging.NotificationsQueue,
		"",    // consumer
		false, // auto-ack
		false, // exclusive
		false, // no-local
		false, // no-wait
		nil,   // args
	)
	if err != nil {
		return fmt.Errorf("failed to register consumer: %w", err)
	}

	log.Println("Notification consumer started, waiting for messages...")

	for {
		select {
		case <-ctx.Done():
			log.Println("Notification consumer stopped")
			return nil
		case msg, ok := <-msgs:
			if !ok {
				return fmt.Errorf("channel closed")
			}
			c.handleMessage(ctx, msg)
		}
	}
}

func (c *NotificationConsumer) handleMessage(ctx context.Context, msg amqp.Delivery) {
	var event contracts.NotificationEvent
	if err := json.Unmarshal(msg.Body, &event); err != nil {
		log.Printf("Failed to unmarshal notification event: %v", err)
		msg.Nack(false, false)
		return
	}

	log.Printf("Processing notification event: type=%s, recipients=%d", event.EventType, len(event.Recipients))

	// Process each recipient
	for _, recipientID := range event.Recipients {
		notification, err := c.buildNotification(&event, recipientID)
		if err != nil {
			log.Printf("Failed to build notification: %v", err)
			continue
		}

		if err := c.service.CreateNotification(ctx, notification); err != nil {
			log.Printf("Failed to create notification: %v", err)
			continue
		}

		log.Printf("Created notification: user=%s, type=%s, id=%s", recipientID, notification.Type, notification.ID)

		// Publish created notification for WebSocket distribution
		if err := c.publishNotificationCreated(notification); err != nil {
			log.Printf("Failed to publish notification created event: %v", err)
			// Don't fail the whole operation if WebSocket publish fails
		}
	}

	msg.Ack(false)
}

func (c *NotificationConsumer) buildNotification(event *contracts.NotificationEvent, recipientID string) (*models.Notification, error) {
	orgID, err := uuid.Parse(event.OrganizationID)
	if err != nil {
		return nil, fmt.Errorf("invalid organization ID: %w", err)
	}

	userID, err := uuid.Parse(recipientID)
	if err != nil {
		return nil, fmt.Errorf("invalid user ID: %w", err)
	}

	triggerUserID, err := uuid.Parse(event.TriggerUserID)
	if err != nil {
		return nil, fmt.Errorf("invalid trigger user ID: %w", err)
	}

	notification := &models.Notification{
		UserID:         userID,
		OrganizationID: orgID,
		TriggerUserID:  triggerUserID,
		IsRead:         false,
	}

	// Build notification based on event type
	switch event.EventType {
	case contracts.NotificationEventTaskCreated:
		return c.buildTaskCreatedNotification(notification, event)
	case contracts.NotificationEventTaskUpdated:
		return c.buildTaskUpdatedNotification(notification, event)
	case contracts.NotificationEventTaskDeleted:
		return c.buildTaskDeletedNotification(notification, event)
	case contracts.NotificationEventCommentCreated:
		return c.buildCommentCreatedNotification(notification, event)
	case contracts.NotificationEventCommentUpdated:
		return c.buildCommentUpdatedNotification(notification, event)
	case contracts.NotificationEventCommentDeleted:
		return c.buildCommentDeletedNotification(notification, event)
	case contracts.NotificationEventCommentMentioned:
		return c.buildCommentMentionedNotification(notification, event)
	default:
		return nil, fmt.Errorf("unknown event type: %s", event.EventType)
	}
}

func (c *NotificationConsumer) buildTaskCreatedNotification(n *models.Notification, event *contracts.NotificationEvent) (*models.Notification, error) {
	data, ok := event.Data.(map[string]interface{})
	if !ok {
		dataBytes, _ := json.Marshal(event.Data)
		if err := json.Unmarshal(dataBytes, &data); err != nil {
			return nil, fmt.Errorf("invalid task data: %w", err)
		}
	}

	taskID, _ := data["taskId"].(string)
	title, _ := data["title"].(string)
	triggerUser, _ := data["triggerUser"].(map[string]interface{})
	triggerUserName := "Someone"
	if triggerUser != nil {
		firstName, _ := triggerUser["firstName"].(string)
		lastName, _ := triggerUser["lastName"].(string)
		triggerUserName = fmt.Sprintf("%s %s", firstName, lastName)
	}

	entityID, _ := uuid.Parse(taskID)
	n.Type = models.NotificationTypeTaskCreated
	n.EntityType = "task"
	n.EntityID = entityID
	n.Title = "New task assigned"
	n.Message = fmt.Sprintf("%s created task: %s", triggerUserName, title)
	n.URL = fmt.Sprintf("/dashboard/tasks/%s", taskID)

	return n, nil
}

func (c *NotificationConsumer) buildTaskUpdatedNotification(n *models.Notification, event *contracts.NotificationEvent) (*models.Notification, error) {
	data, ok := event.Data.(map[string]interface{})
	if !ok {
		dataBytes, _ := json.Marshal(event.Data)
		if err := json.Unmarshal(dataBytes, &data); err != nil {
			return nil, fmt.Errorf("invalid task data: %w", err)
		}
	}

	taskID, _ := data["taskId"].(string)
	title, _ := data["title"].(string)
	triggerUser, _ := data["triggerUser"].(map[string]interface{})
	triggerUserName := "Someone"
	if triggerUser != nil {
		firstName, _ := triggerUser["firstName"].(string)
		lastName, _ := triggerUser["lastName"].(string)
		triggerUserName = fmt.Sprintf("%s %s", firstName, lastName)
	}

	entityID, _ := uuid.Parse(taskID)
	n.Type = models.NotificationTypeTaskUpdated
	n.EntityType = "task"
	n.EntityID = entityID
	n.Title = "Task updated"
	n.Message = fmt.Sprintf("%s updated task: %s", triggerUserName, title)
	n.URL = fmt.Sprintf("/dashboard/tasks/%s", taskID)

	return n, nil
}

func (c *NotificationConsumer) buildTaskDeletedNotification(n *models.Notification, event *contracts.NotificationEvent) (*models.Notification, error) {
	data, ok := event.Data.(map[string]interface{})
	if !ok {
		dataBytes, _ := json.Marshal(event.Data)
		if err := json.Unmarshal(dataBytes, &data); err != nil {
			return nil, fmt.Errorf("invalid task data: %w", err)
		}
	}

	taskID, _ := data["taskId"].(string)
	title, _ := data["title"].(string)
	triggerUser, _ := data["triggerUser"].(map[string]interface{})
	triggerUserName := "Someone"
	if triggerUser != nil {
		firstName, _ := triggerUser["firstName"].(string)
		lastName, _ := triggerUser["lastName"].(string)
		triggerUserName = fmt.Sprintf("%s %s", firstName, lastName)
	}

	entityID, _ := uuid.Parse(taskID)
	n.Type = models.NotificationTypeTaskDeleted
	n.EntityType = "task"
	n.EntityID = entityID
	n.Title = "Task deleted"
	n.Message = fmt.Sprintf("%s deleted task: %s", triggerUserName, title)
	n.URL = fmt.Sprintf("/dashboard/tasks/%s", taskID)

	return n, nil
}

func (c *NotificationConsumer) buildCommentCreatedNotification(n *models.Notification, event *contracts.NotificationEvent) (*models.Notification, error) {
	data, ok := event.Data.(map[string]interface{})
	if !ok {
		dataBytes, _ := json.Marshal(event.Data)
		if err := json.Unmarshal(dataBytes, &data); err != nil {
			return nil, fmt.Errorf("invalid comment data: %w", err)
		}
	}

	commentID, _ := data["commentId"].(string)
	taskID, _ := data["taskId"].(string)
	taskTitle, _ := data["taskTitle"].(string)
	author, _ := data["author"].(map[string]interface{})
	authorName := "Someone"
	if author != nil {
		firstName, _ := author["firstName"].(string)
		lastName, _ := author["lastName"].(string)
		authorName = fmt.Sprintf("%s %s", firstName, lastName)
	}

	entityID, _ := uuid.Parse(commentID)
	n.Type = models.NotificationTypeCommentCreated
	n.EntityType = "comment"
	n.EntityID = entityID
	n.Title = "New comment"
	n.Message = fmt.Sprintf("%s commented on: %s", authorName, taskTitle)
	n.URL = fmt.Sprintf("/dashboard/tasks/%s#comment-%s", taskID, commentID)

	return n, nil
}

func (c *NotificationConsumer) buildCommentUpdatedNotification(n *models.Notification, event *contracts.NotificationEvent) (*models.Notification, error) {
	data, ok := event.Data.(map[string]interface{})
	if !ok {
		dataBytes, _ := json.Marshal(event.Data)
		if err := json.Unmarshal(dataBytes, &data); err != nil {
			return nil, fmt.Errorf("invalid comment data: %w", err)
		}
	}

	commentID, _ := data["commentId"].(string)
	taskID, _ := data["taskId"].(string)
	taskTitle, _ := data["taskTitle"].(string)
	author, _ := data["author"].(map[string]interface{})
	authorName := "Someone"
	if author != nil {
		firstName, _ := author["firstName"].(string)
		lastName, _ := author["lastName"].(string)
		authorName = fmt.Sprintf("%s %s", firstName, lastName)
	}

	entityID, _ := uuid.Parse(commentID)
	n.Type = models.NotificationTypeCommentUpdated
	n.EntityType = "comment"
	n.EntityID = entityID
	n.Title = "Comment updated"
	n.Message = fmt.Sprintf("%s updated a comment on: %s", authorName, taskTitle)
	n.URL = fmt.Sprintf("/dashboard/tasks/%s#comment-%s", taskID, commentID)

	return n, nil
}

func (c *NotificationConsumer) buildCommentDeletedNotification(n *models.Notification, event *contracts.NotificationEvent) (*models.Notification, error) {
	data, ok := event.Data.(map[string]interface{})
	if !ok {
		dataBytes, _ := json.Marshal(event.Data)
		if err := json.Unmarshal(dataBytes, &data); err != nil {
			return nil, fmt.Errorf("invalid comment data: %w", err)
		}
	}

	commentID, _ := data["commentId"].(string)
	taskID, _ := data["taskId"].(string)
	taskTitle, _ := data["taskTitle"].(string)
	author, _ := data["author"].(map[string]interface{})
	authorName := "Someone"
	if author != nil {
		firstName, _ := author["firstName"].(string)
		lastName, _ := author["lastName"].(string)
		authorName = fmt.Sprintf("%s %s", firstName, lastName)
	}

	entityID, _ := uuid.Parse(commentID)
	n.Type = models.NotificationTypeCommentDeleted
	n.EntityType = "comment"
	n.EntityID = entityID
	n.Title = "Comment deleted"
	n.Message = fmt.Sprintf("%s deleted a comment on: %s", authorName, taskTitle)
	n.URL = fmt.Sprintf("/dashboard/tasks/%s", taskID)

	return n, nil
}

func (c *NotificationConsumer) buildCommentMentionedNotification(n *models.Notification, event *contracts.NotificationEvent) (*models.Notification, error) {
	data, ok := event.Data.(map[string]interface{})
	if !ok {
		dataBytes, _ := json.Marshal(event.Data)
		if err := json.Unmarshal(dataBytes, &data); err != nil {
			return nil, fmt.Errorf("invalid comment data: %w", err)
		}
	}

	commentID, _ := data["commentId"].(string)
	taskID, _ := data["taskId"].(string)
	taskTitle, _ := data["taskTitle"].(string)
	author, _ := data["author"].(map[string]interface{})
	authorName := "Someone"
	if author != nil {
		firstName, _ := author["firstName"].(string)
		lastName, _ := author["lastName"].(string)
		authorName = fmt.Sprintf("%s %s", firstName, lastName)
	}

	entityID, _ := uuid.Parse(commentID)
	n.Type = models.NotificationTypeCommentMentioned
	n.EntityType = "comment"
	n.EntityID = entityID
	n.Title = "You were mentioned"
	n.Message = fmt.Sprintf("%s mentioned you in: %s", authorName, taskTitle)
	n.URL = fmt.Sprintf("/dashboard/tasks/%s#comment-%s", taskID, commentID)

	return n, nil
}

// publishNotificationCreated publishes a notification.created event for WebSocket distribution
func (c *NotificationConsumer) publishNotificationCreated(n *models.Notification) error {
	// Create WebSocket distribution message
	wsDistributionMsg := map[string]interface{}{
		"userId": n.UserID.String(),
		"notification": map[string]interface{}{
			"id":         n.ID.String(),
			"type":       string(n.Type),
			"title":      n.Title,
			"message":    n.Message,
			"url":        n.URL,
			"entityType": n.EntityType,
			"entityId":   n.EntityID.String(),
			"isRead":     n.IsRead,
			"createdAt":  n.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		},
	}

	msgBytes, err := json.Marshal(wsDistributionMsg)
	if err != nil {
		return fmt.Errorf("failed to marshal notification: %w", err)
	}

	// Publish to notification-ws-distribution queue for API Gateway to consume
	err = c.rmq.Channel.Publish(
		"",                              // exchange (default)
		"notification-ws-distribution",  // routing key (queue name)
		false,                           // mandatory
		false,                           // immediate
		amqp.Publishing{
			ContentType: "application/json",
			Body:        msgBytes,
		},
	)

	if err != nil {
		return fmt.Errorf("failed to publish WebSocket distribution message: %w", err)
	}

	log.Printf("Published notification for WebSocket distribution: user=%s, id=%s", n.UserID, n.ID)
	return nil
}
