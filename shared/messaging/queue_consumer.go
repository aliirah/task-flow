package messaging

import (
	"encoding/json"
	"log"

	"github.com/aliirah/task-flow/shared/contracts"
)

type QueueConsumer struct {
	rb        *RabbitMQ
	connMgr   *ConnectionManager
	queueName string
}

func NewQueueConsumer(rb *RabbitMQ, connMgr *ConnectionManager, queueName string) *QueueConsumer {
	return &QueueConsumer{
		rb:        rb,
		connMgr:   connMgr,
		queueName: queueName,
	}
}

func (qc *QueueConsumer) Start() error {
	msgs, err := qc.rb.Channel.Consume(
		qc.queueName,
		"",
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return err
	}

	go func() {
		for msg := range msgs {
			var msgBody contracts.AmqpMessage
			if err := json.Unmarshal(msg.Body, &msgBody); err != nil {
				log.Println("Failed to unmarshal message:", err)
				continue
			}

			clientMsg := contracts.WSMessage{
				Type: msgBody.EventType,
				Data: msgBody.Data,
			}

			switch {
			case msgBody.OrganizationID != "":
				if err := qc.connMgr.BroadcastToOrg(msgBody.OrganizationID, clientMsg); err != nil {
					log.Printf("Failed to broadcast to organization %s: %v", msgBody.OrganizationID, err)
				}
			case msgBody.UserID != "":
				if err := qc.connMgr.SendToUser(msgBody.UserID, clientMsg); err != nil {
					log.Printf("Failed to send message to user %s: %v", msgBody.UserID, err)
				}
			default:
				log.Printf("Message missing target information: routing=%s", msg.RoutingKey)
			}
		}
	}()

	return nil
}
