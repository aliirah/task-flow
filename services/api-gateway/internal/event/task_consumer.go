package event

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/aliirah/task-flow/shared/contracts"
	"github.com/aliirah/task-flow/shared/messaging"
	amqp "github.com/rabbitmq/amqp091-go"
)

// TaskEventConsumer handles incoming task events and broadcasts them to WebSocket clients
type TaskEventConsumer struct {
	connMgr *messaging.ConnectionManager
}

// NewTaskEventConsumer creates a new TaskEventConsumer
func NewTaskEventConsumer(connMgr *messaging.ConnectionManager) *TaskEventConsumer {
	return &TaskEventConsumer{
		connMgr: connMgr,
	}
}

// Handle processes incoming task events
func (c *TaskEventConsumer) Handle(ctx context.Context, msg amqp.Delivery) error {
	fmt.Printf("👉 [TaskEventConsumer] Message received from RabbitMQ:\n")
	fmt.Printf("   Exchange: %s\n", msg.Exchange)
	fmt.Printf("   RoutingKey: %s\n", msg.RoutingKey)
	fmt.Printf("   ContentType: %s\n", msg.ContentType)
	fmt.Printf("   Body: %s\n\n", string(msg.Body))

	var amqpMsg contracts.AmqpMessage
	if err := json.Unmarshal(msg.Body, &amqpMsg); err != nil {
		fmt.Printf("❌ [TaskEventConsumer] Failed to unmarshal AMQP message: %v\n", err)
		fmt.Printf("   Body: %s\n", string(msg.Body))
		return fmt.Errorf("failed to unmarshal AMQP message: %w", err)
	}

	fmt.Printf("✅ [TaskEventConsumer] AMQP message parsed:\n")
	fmt.Printf("   EventType: %s\n", amqpMsg.EventType)
	fmt.Printf("   OrganizationID: %s\n", amqpMsg.OrganizationID)
	fmt.Printf("   UserID: %s\n\n", amqpMsg.UserID)

	var taskEvent contracts.TaskCreatedEvent
	if err := json.Unmarshal(amqpMsg.Data, &taskEvent); err != nil {
		fmt.Printf("❌ [TaskEventConsumer] Failed to unmarshal task event data: %v\n", err)
		fmt.Printf("   Data: %s\n", string(amqpMsg.Data))
		return fmt.Errorf("failed to unmarshal task event data: %w", err)
	}

	fmt.Printf("✅ [TaskEventConsumer] Task event parsed:\n")
	fmt.Printf("   TaskID: %s\n", taskEvent.TaskID)
	fmt.Printf("   Title: %s\n", taskEvent.Title)
	fmt.Printf("   OrganizationID: %s\n", taskEvent.OrganizationID)
	fmt.Printf("   AssigneeID: %s\n\n", taskEvent.AssigneeID)

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
		log.Printf("[TaskEventConsumer] ERROR: Failed to broadcast message to organization %s: %v",
			amqpMsg.OrganizationID, err)
		return fmt.Errorf("failed to broadcast message: %w", err)
	}

	log.Printf("[TaskEventConsumer] Successfully broadcast task event to organization %s",
		amqpMsg.OrganizationID)
	return nil
}
