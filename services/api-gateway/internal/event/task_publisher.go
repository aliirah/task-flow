package event

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/aliirah/task-flow/shared/contracts"
	"github.com/aliirah/task-flow/shared/messaging"
	taskpb "github.com/aliirah/task-flow/shared/proto/task/v1"
	tasktransform "github.com/aliirah/task-flow/shared/transform/task"
)

// TaskEventPublisher describes the behaviour required to broadcast task lifecycle events.
type TaskEventPublisher interface {
	TaskCreated(ctx context.Context, task *taskpb.Task) error
}

// NewTaskPublisher builds a RabbitMQ-backed TaskEventPublisher. A no-op publisher is returned when mq is nil.
func NewTaskPublisher(mq *messaging.RabbitMQ) TaskEventPublisher {
	if mq == nil {
		return noopTaskPublisher{}
	}
	return &taskPublisher{mq: mq}
}

type taskPublisher struct {
	mq *messaging.RabbitMQ
}

func (p *taskPublisher) TaskCreated(ctx context.Context, task *taskpb.Task) error {
	if p == nil || p.mq == nil || task == nil {
		return nil
	}

	payload := tasktransform.ToCreatedEvent(task)
	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal task created event: %w", err)
	}

	msg := contracts.AmqpMessage{
		OrganizationID: payload.OrganizationID,
		EventType:      contracts.TaskEventCreated,
		Data:           data,
	}

	return p.mq.PublishMessage(ctx, contracts.TaskEventCreated, msg)
}

type noopTaskPublisher struct{}

func (noopTaskPublisher) TaskCreated(context.Context, *taskpb.Task) error { return nil }
