package messaging

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/aliirah/task-flow/shared/contracts"
	amqp "github.com/rabbitmq/amqp091-go"
)

// NotificationPublisher handles publishing notification events
type NotificationPublisher struct {
	rmq *RabbitMQ
}

// NewNotificationPublisher creates a new notification publisher
func NewNotificationPublisher(rmq *RabbitMQ) *NotificationPublisher {
	return &NotificationPublisher{rmq: rmq}
}

// PublishNotification publishes a notification event to RabbitMQ
func (p *NotificationPublisher) PublishNotification(ctx context.Context, event *contracts.NotificationEvent) error {
	if p.rmq == nil || p.rmq.Channel == nil {
		return fmt.Errorf("rabbitmq connection not initialized")
	}

	body, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	fmt.Printf("[DEBUG] Publishing notification to exchange=%s, routingKey=%s, recipients=%v\n", 
		EventExchange, event.EventType, event.Recipients)
	
	err = p.rmq.Channel.PublishWithContext(
		ctx,
		EventExchange,      // exchange
		event.EventType,    // routing key
		false,              // mandatory
		false,              // immediate
		amqp.Publishing{
			ContentType:  "application/json",
			Body:         body,
			DeliveryMode: amqp.Persistent,
		},
	)
	if err != nil {
		return fmt.Errorf("failed to publish notification: %w", err)
	}

	fmt.Printf("[DEBUG] Successfully published notification to RabbitMQ\n")
	return nil
}

// PublishTaskCreated publishes a task created notification
func (p *NotificationPublisher) PublishTaskCreated(
	ctx context.Context,
	organizationID string,
	triggerUserID string,
	recipients []string,
	data *contracts.TaskNotificationData,
) error {
	event := &contracts.NotificationEvent{
		OrganizationID: organizationID,
		TriggerUserID:  triggerUserID,
		Recipients:     recipients,
		EventType:      contracts.NotificationEventTaskCreated,
		Data:           data,
	}
	return p.PublishNotification(ctx, event)
}

// PublishTaskUpdated publishes a task updated notification
func (p *NotificationPublisher) PublishTaskUpdated(
	ctx context.Context,
	organizationID string,
	triggerUserID string,
	recipients []string,
	data *contracts.TaskNotificationData,
) error {
	event := &contracts.NotificationEvent{
		OrganizationID: organizationID,
		TriggerUserID:  triggerUserID,
		Recipients:     recipients,
		EventType:      contracts.NotificationEventTaskUpdated,
		Data:           data,
	}
	return p.PublishNotification(ctx, event)
}

// PublishTaskDeleted publishes a task deleted notification
func (p *NotificationPublisher) PublishTaskDeleted(
	ctx context.Context,
	organizationID string,
	triggerUserID string,
	recipients []string,
	data *contracts.TaskNotificationData,
) error {
	event := &contracts.NotificationEvent{
		OrganizationID: organizationID,
		TriggerUserID:  triggerUserID,
		Recipients:     recipients,
		EventType:      contracts.NotificationEventTaskDeleted,
		Data:           data,
	}
	return p.PublishNotification(ctx, event)
}

// PublishCommentCreated publishes a comment created notification
func (p *NotificationPublisher) PublishCommentCreated(
	ctx context.Context,
	organizationID string,
	triggerUserID string,
	recipients []string,
	data *contracts.CommentNotificationData,
) error {
	event := &contracts.NotificationEvent{
		OrganizationID: organizationID,
		TriggerUserID:  triggerUserID,
		Recipients:     recipients,
		EventType:      contracts.NotificationEventCommentCreated,
		Data:           data,
	}
	return p.PublishNotification(ctx, event)
}

// PublishCommentUpdated publishes a comment updated notification
func (p *NotificationPublisher) PublishCommentUpdated(
	ctx context.Context,
	organizationID string,
	triggerUserID string,
	recipients []string,
	data *contracts.CommentNotificationData,
) error {
	event := &contracts.NotificationEvent{
		OrganizationID: organizationID,
		TriggerUserID:  triggerUserID,
		Recipients:     recipients,
		EventType:      contracts.NotificationEventCommentUpdated,
		Data:           data,
	}
	return p.PublishNotification(ctx, event)
}

// PublishCommentDeleted publishes a comment deleted notification
func (p *NotificationPublisher) PublishCommentDeleted(
	ctx context.Context,
	organizationID string,
	triggerUserID string,
	recipients []string,
	data *contracts.CommentNotificationData,
) error {
	event := &contracts.NotificationEvent{
		OrganizationID: organizationID,
		TriggerUserID:  triggerUserID,
		Recipients:     recipients,
		EventType:      contracts.NotificationEventCommentDeleted,
		Data:           data,
	}
	return p.PublishNotification(ctx, event)
}

// PublishCommentMention publishes a comment mention notification
func (p *NotificationPublisher) PublishCommentMention(
	ctx context.Context,
	organizationID string,
	triggerUserID string,
	recipients []string,
	data *contracts.CommentNotificationData,
) error {
	event := &contracts.NotificationEvent{
		OrganizationID: organizationID,
		TriggerUserID:  triggerUserID,
		Recipients:     recipients,
		EventType:      contracts.NotificationEventCommentMentioned,
		Data:           data,
	}
	return p.PublishNotification(ctx, event)
}
