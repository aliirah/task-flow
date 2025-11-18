package event

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/aliirah/task-flow/shared/contracts"
	"github.com/aliirah/task-flow/shared/logging"
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
	logging.S().Info("comment consumer listening for events")
	return cc.rabbitmq.ConsumeMessages(messaging.CommentEventsQueue, cc.handle)
}

func (cc *CommentConsumer) handle(ctx context.Context, msg amqp.Delivery) error {
	logging.S().Infow("comment consumer received message", "routingKey", msg.RoutingKey)

	// Parse the AMQP message wrapper
	var amqpMsg contracts.AmqpMessage
	if err := json.Unmarshal(msg.Body, &amqpMsg); err != nil {
		logging.S().Errorw("comment consumer failed to unmarshal message", "error", err)
		return fmt.Errorf("failed to unmarshal AMQP message: %w", err)
	}

	logging.S().Infow("comment event received", "eventType", amqpMsg.EventType, "orgId", amqpMsg.OrganizationID)

	if amqpMsg.OrganizationID == "" {
		logging.S().Warn("comment consumer skipping event with empty organization id")
		return nil
	}

	// Parse the actual event data based on type
	var eventData interface{}
	switch amqpMsg.EventType {
	case contracts.CommentEventCreated:
		var event contracts.CommentCreatedEvent
		if err := json.Unmarshal(amqpMsg.Data, &event); err != nil {
			logging.S().Errorw("comment consumer failed to parse created event", "error", err)
			return nil
		}
		eventData = event
		logging.S().Infow("comment created event", "taskId", event.TaskID, "commentId", event.CommentID)

	case contracts.CommentEventUpdated:
		var event contracts.CommentUpdatedEvent
		if err := json.Unmarshal(amqpMsg.Data, &event); err != nil {
			logging.S().Errorw("comment consumer failed to parse updated event", "error", err)
			return nil
		}
		eventData = event
		logging.S().Infow("comment updated event", "taskId", event.TaskID, "commentId", event.CommentID)

	case contracts.CommentEventDeleted:
		var event contracts.CommentDeletedEvent
		if err := json.Unmarshal(amqpMsg.Data, &event); err != nil {
			logging.S().Errorw("comment consumer failed to parse deleted event", "error", err)
			return nil
		}
		eventData = event
		logging.S().Infow("comment deleted event", "taskId", event.TaskID, "commentId", event.CommentID)

	default:
		logging.S().Warnw("comment consumer received unknown event type", "eventType", amqpMsg.EventType)
		return nil
	}

	// Create WebSocket message
	wsMsg := contracts.WSMessage{
		Type: amqpMsg.EventType,
		Data: eventData,
	}

	// Broadcast to all connections in the organization
	if err := cc.connMgr.BroadcastToOrg(amqpMsg.OrganizationID, wsMsg); err != nil {
		logging.S().Errorw("comment consumer failed to broadcast", "orgId", amqpMsg.OrganizationID, "error", err)
		return err
	}

	logging.S().Infow("comment consumer broadcasted event", "eventType", amqpMsg.EventType, "orgId", amqpMsg.OrganizationID)
	return nil
}
