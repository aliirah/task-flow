package event

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/aliirah/task-flow/shared/contracts"
	"github.com/aliirah/task-flow/shared/messaging"
	amqp "github.com/rabbitmq/amqp091-go"
)

type NotificationConsumer struct {
	rabbitmq *messaging.RabbitMQ
	connMgr  *messaging.ConnectionManager
}

func NewNotificationConsumer(rabbitmq *messaging.RabbitMQ, connMgr *messaging.ConnectionManager) *NotificationConsumer {
	return &NotificationConsumer{
		rabbitmq: rabbitmq,
		connMgr:  connMgr,
	}
}

func (c *NotificationConsumer) Listen() error {
	fmt.Println("[NotificationConsumer] Starting to listen for notification WebSocket distribution...")
	
	// Declare the queue if it doesn't exist
	_, err := c.rabbitmq.Channel.QueueDeclare(
		"notification-ws-distribution", // queue name
		true,                           // durable
		false,                          // delete when unused
		false,                          // exclusive
		false,                          // no-wait
		nil,                            // arguments
	)
	if err != nil {
		return fmt.Errorf("failed to declare queue: %w", err)
	}

	msgs, err := c.rabbitmq.Channel.Consume(
		"notification-ws-distribution", // queue
		"",                             // consumer
		false,                          // auto-ack
		false,                          // exclusive
		false,                          // no-local
		false,                          // no-wait
		nil,                            // args
	)
	if err != nil {
		return fmt.Errorf("failed to register consumer: %w", err)
	}

	go func() {
		for msg := range msgs {
			if err := c.handle(context.Background(), msg); err != nil {
				fmt.Printf("[NotificationConsumer] Error handling message: %v\n", err)
			}
			msg.Ack(false)
		}
	}()

	fmt.Println("[NotificationConsumer] Successfully started")
	return nil
}

func (c *NotificationConsumer) handle(ctx context.Context, msg amqp.Delivery) error {
	fmt.Printf("[NotificationConsumer] 📬 Received WebSocket distribution message\n")

	// Parse the message
	var wsDistMsg struct {
		UserID       string                 `json:"userId"`
		Notification map[string]interface{} `json:"notification"`
	}

	if err := json.Unmarshal(msg.Body, &wsDistMsg); err != nil {
		fmt.Printf("[NotificationConsumer] ❌ Failed to unmarshal message: %v\n", err)
		return fmt.Errorf("failed to unmarshal message: %w", err)
	}

	fmt.Printf("[NotificationConsumer] 🔔 Distributing notification to user %s: %s (isRead=%v)\n", 
		wsDistMsg.UserID, 
		wsDistMsg.Notification["title"], 
		wsDistMsg.Notification["isRead"])

	// Create WebSocket message
	wsMsg := contracts.WSMessage{
		Type: "notification.created",
		Data: wsDistMsg.Notification,
	}

	// Send to specific user
	if err := c.connMgr.SendToUser(wsDistMsg.UserID, wsMsg); err != nil {
		fmt.Printf("[NotificationConsumer] ❌ Failed to send to user %s: %v\n", wsDistMsg.UserID, err)
		return err
	}

	fmt.Printf("[NotificationConsumer] ✅ Successfully sent notification to user %s\n", wsDistMsg.UserID)
	return nil
}
