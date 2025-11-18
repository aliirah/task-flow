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

// TaskConsumer consumes task events from RabbitMQ and broadcasts them via WebSocket
type TaskConsumer struct {
	rabbitmq *messaging.RabbitMQ
	connMgr  *messaging.ConnectionManager
}

// NewTaskConsumer creates a new task event consumer
func NewTaskConsumer(rabbitmq *messaging.RabbitMQ, connMgr *messaging.ConnectionManager) *TaskConsumer {
	return &TaskConsumer{
		rabbitmq: rabbitmq,
		connMgr:  connMgr,
	}
}

// Listen starts consuming task events and broadcasting them via WebSocket
func (tc *TaskConsumer) Listen() error {
	logging.S().Info("task consumer listening for events")
	return tc.rabbitmq.ConsumeMessages(messaging.TaskEventsQueue, tc.handle)
}

func (tc *TaskConsumer) handle(ctx context.Context, msg amqp.Delivery) error {
	logging.S().Infow("task consumer received message", "routingKey", msg.RoutingKey)

	// Parse the AMQP message wrapper
	var amqpMsg contracts.AmqpMessage
	if err := json.Unmarshal(msg.Body, &amqpMsg); err != nil {
		logging.S().Errorw("task consumer failed to unmarshal message", "error", err)
		return fmt.Errorf("failed to unmarshal AMQP message: %w", err)
	}

	logging.S().Infow("task event received", "eventType", amqpMsg.EventType, "orgId", amqpMsg.OrganizationID)

	if amqpMsg.OrganizationID == "" {
		logging.S().Warn("task consumer skipping event with empty organization id")
		return nil
	}

	// Parse the actual event data based on type
	var eventData interface{}
	switch amqpMsg.EventType {
	case contracts.TaskEventCreated:
		var event contracts.TaskCreatedEvent
		if err := json.Unmarshal(amqpMsg.Data, &event); err != nil {
			logging.S().Errorw("task consumer failed to parse created event", "error", err)
			return nil
		}
		eventData = event
		logging.S().Infow("task created event", "taskId", event.TaskID, "title", event.Title)

	case contracts.TaskEventUpdated:
		var event contracts.TaskUpdatedEvent
		if err := json.Unmarshal(amqpMsg.Data, &event); err != nil {
			logging.S().Errorw("task consumer failed to parse updated event", "error", err)
			return nil
		}
		eventData = event
		logging.S().Infow("task updated event", "taskId", event.TaskID, "title", event.Title)

	default:
		logging.S().Warnw("task consumer received unknown event type", "eventType", amqpMsg.EventType)
		return nil
	}

	// Create WebSocket message
	wsMsg := contracts.WSMessage{
		Type: amqpMsg.EventType,
		Data: eventData,
	}

	// Broadcast to all connections in the organization
	if err := tc.connMgr.BroadcastToOrg(amqpMsg.OrganizationID, wsMsg); err != nil {
		logging.S().Errorw("task consumer failed to broadcast", "orgId", amqpMsg.OrganizationID, "error", err)
		return err
	}

	logging.S().Infow("task consumer broadcasted event", "eventType", amqpMsg.EventType, "orgId", amqpMsg.OrganizationID)
	return nil
}
