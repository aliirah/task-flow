package event

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/aliirah/task-flow/shared/contracts"
	"github.com/aliirah/task-flow/shared/messaging"
	amqp "github.com/rabbitmq/amqp091-go"
)

// CommentConsumer consumes comment events from RabbitMQ and broadcasts them via WebSocket
type CommentConsumer struct {
	rabbitmq *messaging.RabbitMQ
	connMgr  *messaging.ConnectionManager
}

// NewCommentConsumer creates a new comment event consumer
func NewCommentConsumer(rabbitmq *messaging.RabbitMQ, connMgr *messaging.ConnectionManager) *CommentConsumer {
	return &CommentConsumer{
		rabbitmq: rabbitmq,
		connMgr:  connMgr,
	}
}

// Listen starts consuming comment events and broadcasting them via WebSocket
func (cc *CommentConsumer) Listen() error {
	fmt.Println("[CommentConsumer] Starting to listen for comment events...")
	return cc.rabbitmq.ConsumeMessages(messaging.CommentEventsQueue, cc.handle)
}

func (cc *CommentConsumer) handle(ctx context.Context, msg amqp.Delivery) error {
	fmt.Printf("[CommentConsumer] Received message with routing key: %s\n", msg.RoutingKey)

	// Parse the AMQP message wrapper
	var amqpMsg contracts.AmqpMessage
	if err := json.Unmarshal(msg.Body, &amqpMsg); err != nil {
		fmt.Printf("[CommentConsumer] Failed to unmarshal AMQP message: %v\n", err)
		return fmt.Errorf("failed to unmarshal AMQP message: %w", err)
	}

	fmt.Printf("[CommentConsumer] Event type: %s, OrgID: %s\n", amqpMsg.EventType, amqpMsg.OrganizationID)

	if amqpMsg.OrganizationID == "" {
		fmt.Printf("[CommentConsumer] No organization ID in event, skipping broadcast\n")
		return nil
	}

	// Parse the actual event data based on type
	var eventData interface{}
	switch amqpMsg.EventType {
	case contracts.CommentEventCreated:
		var event contracts.CommentCreatedEvent
		if err := json.Unmarshal(amqpMsg.Data, &event); err != nil {
			fmt.Printf("[CommentConsumer] Failed to parse CommentCreatedEvent: %v\n", err)
			return nil
		}
		eventData = event
		fmt.Printf("[CommentConsumer] Comment created on task %s (%s)\n", event.TaskID, event.CommentID)

	case contracts.CommentEventUpdated:
		var event contracts.CommentUpdatedEvent
		if err := json.Unmarshal(amqpMsg.Data, &event); err != nil {
			fmt.Printf("[CommentConsumer] Failed to parse CommentUpdatedEvent: %v\n", err)
			return nil
		}
		eventData = event
		fmt.Printf("[CommentConsumer] Comment updated on task %s (%s)\n", event.TaskID, event.CommentID)

	case contracts.CommentEventDeleted:
		var event contracts.CommentDeletedEvent
		if err := json.Unmarshal(amqpMsg.Data, &event); err != nil {
			fmt.Printf("[CommentConsumer] Failed to parse CommentDeletedEvent: %v\n", err)
			return nil
		}
		eventData = event
		fmt.Printf("[CommentConsumer] Comment deleted on task %s (%s)\n", event.TaskID, event.CommentID)

	default:
		fmt.Printf("[CommentConsumer] Unknown event type: %s\n", amqpMsg.EventType)
		return nil
	}

	// Create WebSocket message
	wsMsg := contracts.WSMessage{
		Type: amqpMsg.EventType,
		Data: eventData,
	}

	// Broadcast to all connections in the organization
	if err := cc.connMgr.BroadcastToOrg(amqpMsg.OrganizationID, wsMsg); err != nil {
		fmt.Printf("[CommentConsumer] Failed to broadcast to org %s: %v\n", amqpMsg.OrganizationID, err)
		return err
	}

	fmt.Printf("[CommentConsumer] Successfully broadcasted %s to organization %s\n", amqpMsg.EventType, amqpMsg.OrganizationID)
	return nil
}
