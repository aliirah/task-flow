package metrics

import (
	"context"
	"time"

	"github.com/aliirah/task-flow/shared/contracts"
)

// RecordRabbitMQMetrics records metrics for RabbitMQ message processing
func RecordRabbitMQMetrics(queue, eventType string, msgSize int64, fn func() error) error {
	start := time.Now()
	err := fn()
	duration := time.Since(start)

	status := "success"
	if err != nil {
		status = "error"
	}

	// Record message processing duration
	RabbitMQMessageDuration.WithLabelValues(queue, eventType, status).Observe(duration.Seconds())

	// Increment message counter
	RabbitMQMessageTotal.WithLabelValues(queue, eventType, status).Inc()

	// Record message size
	RabbitMQMessageSize.WithLabelValues(queue, eventType).Observe(float64(msgSize))

	return err
}

// WrapMessageHandler wraps a RabbitMQ message handler with metrics
func WrapMessageHandler(queue string, handler func(ctx context.Context, msg contracts.AmqpMessage) error) func(ctx context.Context, msg contracts.AmqpMessage) error {
	return func(ctx context.Context, msg contracts.AmqpMessage) error {
		msgSize := int64(len(msg.Data))
		return RecordRabbitMQMetrics(queue, msg.EventType, msgSize, func() error {
			return handler(ctx, msg)
		})
	}
}
