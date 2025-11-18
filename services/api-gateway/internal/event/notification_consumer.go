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
	logging.S().Info("notification consumer listening for ws distribution")

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
				logging.S().Errorw("notification consumer failed to handle message", "error", err)
			}
			msg.Ack(false)
		}
	}()

	logging.S().Info("notification consumer started")
	return nil
}

func (c *NotificationConsumer) handle(ctx context.Context, msg amqp.Delivery) error {
	logging.S().Infow("notification consumer received message")

	// Parse the message
	var wsDistMsg struct {
		UserID       string                 `json:"userId"`
		Notification map[string]interface{} `json:"notification"`
	}

	if err := json.Unmarshal(msg.Body, &wsDistMsg); err != nil {
		logging.S().Errorw("notification consumer failed to unmarshal message", "error", err)
		return fmt.Errorf("failed to unmarshal message: %w", err)
	}

	logging.S().Infow("notification consumer distributing notification",
		"userId", wsDistMsg.UserID,
		"title", wsDistMsg.Notification["title"],
		"isRead", wsDistMsg.Notification["isRead"],
	)

	// Create WebSocket message
	wsMsg := contracts.WSMessage{
		Type: "notification.created",
		Data: wsDistMsg.Notification,
	}

	// Send to specific user
	if err := c.connMgr.SendToUser(wsDistMsg.UserID, wsMsg); err != nil {
		logging.S().Errorw("notification consumer failed to send to user", "userId", wsDistMsg.UserID, "error", err)
		return err
	}

	logging.S().Infow("notification consumer sent notification", "userId", wsDistMsg.UserID)
	return nil
}
