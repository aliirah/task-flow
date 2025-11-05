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

	var taskEvent contracts.TaskCreatedEvent
	if err := json.Unmarshal(amqpMsg.Data, &taskEvent); err != nil {
		fmt.Printf("[TaskEventConsumer] Failed to unmarshal task event data: %v", err)
		return fmt.Errorf("failed to unmarshal task event data: %w", err)
	}

	fmt.Printf("[TaskEventConsumer] Processing task event: %s for org: %s", taskEvent.TaskID, taskEvent.OrganizationID)

	// Validate required fields
	if amqpMsg.OrganizationID == "" {
		return fmt.Errorf("organization_id is required for task events")
	}

	// Convert the message to a WebSocket message
	wsMsg := contracts.WSMessage{
		Type: amqpMsg.EventType,
		Data: taskEvent,
	}

	// Broadcast to organization
	// All connected users in the organization will receive the event if they have permission
	// Permissions are already validated during WebSocket connection setup
	if err := c.connMgr.BroadcastToOrg(amqpMsg.OrganizationID, wsMsg); err != nil {
		fmt.Printf("[TaskEventConsumer] Failed to broadcast message: %v", err)
		return fmt.Errorf("failed to broadcast message: %w", err)
	}

	fmt.Printf("[TaskEventConsumer] Successfully broadcast task event: %s", taskEvent.TaskID)
	return nil
}
