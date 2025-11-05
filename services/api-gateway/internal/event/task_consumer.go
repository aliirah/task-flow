package event

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/aliirah/task-flow/shared/contracts"
	"github.com/aliirah/task-flow/shared/messaging"
	amqp "github.com/rabbitmq/amqp091-go"
)

type TaskEventConsumer struct {
	rabbitmq *messaging.RabbitMQ
	connMgr  *messaging.ConnectionManager
}

func NewTaskEventConsumer(rabbitmq *messaging.RabbitMQ, connMgr *messaging.ConnectionManager) *TaskEventConsumer {
	return &TaskEventConsumer{
		rabbitmq: rabbitmq,
		connMgr:  connMgr,
	}
}

func (c *TaskEventConsumer) Listen() error {
	return c.rabbitmq.ConsumeMessages(messaging.TaskEventsQueue, c.handle)
}

func (c *TaskEventConsumer) handle(ctx context.Context, msg amqp.Delivery) error {
	fmt.Printf("[TaskEventConsumer] Received message with routing key: %s", msg.RoutingKey)

	var amqpMsg contracts.AmqpMessage
	if err := json.Unmarshal(msg.Body, &amqpMsg); err != nil {
		fmt.Printf("[TaskEventConsumer] Failed to unmarshal AMQP message: %v", err)
		return fmt.Errorf("failed to unmarshal AMQP message: %w", err)
	}

	// Validate required fields
	if amqpMsg.OrganizationID == "" {
		return fmt.Errorf("organization_id is required for task events")
	}

	var wsMsg contracts.WSMessage
	switch amqpMsg.EventType {
	case contracts.TaskEventCreated:
		var taskEvent contracts.TaskCreatedEvent
		if err := json.Unmarshal(amqpMsg.Data, &taskEvent); err != nil {
			fmt.Printf("[TaskEventConsumer] Failed to unmarshal task created event data: %v", err)
			return fmt.Errorf("failed to unmarshal task created event data: %w", err)
		}
		fmt.Printf("[TaskEventConsumer] Processing task created event: %s for org: %s", taskEvent.TaskID, taskEvent.OrganizationID)
		wsMsg = contracts.WSMessage{
			Type: amqpMsg.EventType,
			Data: taskEvent,
		}
	case contracts.TaskEventUpdated:
		var taskEvent contracts.TaskUpdatedEvent
		if err := json.Unmarshal(amqpMsg.Data, &taskEvent); err != nil {
			fmt.Printf("[TaskEventConsumer] Failed to unmarshal task updated event data: %v", err)
			return fmt.Errorf("failed to unmarshal task updated event data: %w", err)
		}
		fmt.Printf("[TaskEventConsumer] Processing task updated event: %s for org: %s", taskEvent.TaskID, taskEvent.OrganizationID)
		wsMsg = contracts.WSMessage{
			Type: amqpMsg.EventType,
			Data: taskEvent,
		}
	default:
		return fmt.Errorf("unknown task event type: %s", amqpMsg.EventType)
	}

	// Broadcast to organization
	// All connected users in the organization will receive the event if they have permission
	// Permissions are already validated during WebSocket connection setup
	if err := c.connMgr.BroadcastToOrg(amqpMsg.OrganizationID, wsMsg); err != nil {
		fmt.Printf("[TaskEventConsumer] Failed to broadcast message: %v", err)
		return fmt.Errorf("failed to broadcast message: %w", err)
	}

	fmt.Printf("[TaskEventConsumer] Successfully broadcast task event for org: %s", amqpMsg.OrganizationID)
	return nil
}
