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
	fmt.Printf("[TaskEventConsumer] Received message with routing key: %s\n", msg.RoutingKey)
	fmt.Printf("[TaskEventConsumer] Raw message body: %s\n", string(msg.Body))

	var amqpMsg contracts.AmqpMessage
	if err := json.Unmarshal(msg.Body, &amqpMsg); err != nil {
		fmt.Printf("[TaskEventConsumer] Failed to unmarshal AMQP message: %v\n", err)
		return fmt.Errorf("failed to unmarshal AMQP message: %w", err)
	}

	fmt.Printf("[TaskEventConsumer] Parsed AMQP message - Type: %s, OrgID: %s\n", amqpMsg.EventType, amqpMsg.OrganizationID)
	fmt.Printf("[TaskEventConsumer] Raw event data: %s\n", string(amqpMsg.Data))

	// Validate required fields
	if amqpMsg.OrganizationID == "" {
		return fmt.Errorf("organization_id is required for task events")
	}

	// Parse the event data based on the event type
	var eventData interface{}
	switch amqpMsg.EventType {
	case contracts.TaskEventCreated:
		var taskEvent contracts.TaskCreatedEvent
		if err := json.Unmarshal(amqpMsg.Data, &taskEvent); err != nil {
			fmt.Printf("[TaskEventConsumer] Failed to unmarshal task created event: %v\n", err)
			return fmt.Errorf("failed to unmarshal task created event: %w", err)
		}
		eventData = taskEvent
	case contracts.TaskEventUpdated:
		var taskEvent contracts.TaskUpdatedEvent
		if err := json.Unmarshal(amqpMsg.Data, &taskEvent); err != nil {
			fmt.Printf("[TaskEventConsumer] Failed to unmarshal task updated event: %v\n", err)
			return fmt.Errorf("failed to unmarshal task updated event: %w", err)
		}
		eventData = taskEvent
	default:
		return fmt.Errorf("unknown event type: %s", amqpMsg.EventType)
	}

	wsMsg := contracts.WSMessage{
		Type: amqpMsg.EventType,
		Data: eventData,
	}

	// Add debug logging for the final WebSocket message
	if data, err := json.Marshal(wsMsg); err == nil {
		fmt.Printf("[TaskEventConsumer] Prepared WebSocket message: %s\n", string(data))
	}

	// Broadcast to organization
	if err := c.connMgr.BroadcastToOrg(amqpMsg.OrganizationID, wsMsg); err != nil {
		fmt.Printf("[TaskEventConsumer] Failed to broadcast message: %v\n", err)
		return fmt.Errorf("failed to broadcast message: %w", err)
	}

	fmt.Printf("[TaskEventConsumer] Successfully broadcast task event for org: %s\n", amqpMsg.OrganizationID)
	return nil
}
