package event

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/aliirah/task-flow/shared/contracts"
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
	fmt.Println("[TaskConsumer] Starting to listen for task events...")
	return tc.rabbitmq.ConsumeMessages(messaging.TaskEventsQueue, tc.handle)
}

func (tc *TaskConsumer) handle(ctx context.Context, msg amqp.Delivery) error {
	fmt.Printf("[TaskConsumer] Received message with routing key: %s\n", msg.RoutingKey)

	// Parse the AMQP message wrapper
	var amqpMsg contracts.AmqpMessage
	if err := json.Unmarshal(msg.Body, &amqpMsg); err != nil {
		fmt.Printf("[TaskConsumer] Failed to unmarshal AMQP message: %v\n", err)
		return fmt.Errorf("failed to unmarshal AMQP message: %w", err)
	}

	fmt.Printf("[TaskConsumer] Event type: %s, OrgID: %s\n", amqpMsg.EventType, amqpMsg.OrganizationID)

	if amqpMsg.OrganizationID == "" {
		fmt.Printf("[TaskConsumer] No organization ID in event, skipping broadcast\n")
		return nil
	}

	// Parse the actual event data based on type
	var eventData interface{}
	switch amqpMsg.EventType {
	case contracts.TaskEventCreated:
		var event contracts.TaskCreatedEvent
		if err := json.Unmarshal(amqpMsg.Data, &event); err != nil {
			fmt.Printf("[TaskConsumer] Failed to parse TaskCreatedEvent: %v\n", err)
			return nil
		}
		eventData = event
		fmt.Printf("[TaskConsumer] Task created: %s (%s)\n", event.Title, event.TaskID)

	case contracts.TaskEventUpdated:
		var event contracts.TaskUpdatedEvent
		if err := json.Unmarshal(amqpMsg.Data, &event); err != nil {
			fmt.Printf("[TaskConsumer] Failed to parse TaskUpdatedEvent: %v\n", err)
			return nil
		}
		eventData = event
		fmt.Printf("[TaskConsumer] Task updated: %s (%s)\n", event.Title, event.TaskID)

	default:
		fmt.Printf("[TaskConsumer] Unknown event type: %s\n", amqpMsg.EventType)
		return nil
	}

	// Create WebSocket message
	wsMsg := contracts.WSMessage{
		Type: amqpMsg.EventType,
		Data: eventData,
	}

	// Broadcast to all connections in the organization
	if err := tc.connMgr.BroadcastToOrg(amqpMsg.OrganizationID, wsMsg); err != nil {
		fmt.Printf("[TaskConsumer] Failed to broadcast to org %s: %v\n", amqpMsg.OrganizationID, err)
		return err
	}

	fmt.Printf("[TaskConsumer] Successfully broadcasted %s to organization %s\n", amqpMsg.EventType, amqpMsg.OrganizationID)
	return nil
}
