package event

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/aliirah/task-flow/services/task-service/internal/models"
	"github.com/aliirah/task-flow/shared/contracts"
	"github.com/aliirah/task-flow/shared/messaging"

	userpb "github.com/aliirah/task-flow/shared/proto/user/v1"
)

// TaskEventPublisher describes the behaviour required to broadcast task lifecycle events.
type TaskEventPublisher interface {
	TaskCreated(ctx context.Context, task *models.Task, reporter, assignee *userpb.User) error
	TaskUpdated(ctx context.Context, task *models.Task, reporter, assignee *userpb.User) error
}

// NewTaskPublisher builds a RabbitMQ-backed TaskEventPublisher
func NewTaskPublisher(mq *messaging.RabbitMQ) TaskEventPublisher {
	if mq == nil {
		return noopTaskPublisher{}
	}
	return &taskPublisher{mq: mq}
}

type taskPublisher struct {
	mq *messaging.RabbitMQ
}

func (p *taskPublisher) TaskCreated(ctx context.Context, task *models.Task, reporter, assignee *userpb.User) error {
	if p == nil || p.mq == nil || task == nil {
		return nil
	}

	eventData := &contracts.TaskCreatedEvent{
		TaskID:         task.ID.String(),
		OrganizationID: task.OrganizationID.String(),
		Title:          task.Title,
		Description:    task.Description,
		Status:         task.Status,
		Priority:       task.Priority,
		AssigneeID:     task.AssigneeID.String(),
		ReporterID:     task.ReporterID.String(),
	}

	// Add reporter details if available
	if reporter != nil {
		eventData.Reporter = &contracts.TaskUser{
			ID:        reporter.Id,
			FirstName: reporter.FirstName,
			LastName:  reporter.LastName,
			Email:     reporter.Email,
		}
	}

	// Add assignee details if available
	if assignee != nil {
		eventData.Assignee = &contracts.TaskUser{
			ID:        assignee.Id,
			FirstName: assignee.FirstName,
			LastName:  assignee.LastName,
			Email:     assignee.Email,
		}
	}

	if task.DueAt != nil {
		eventData.DueAt = task.DueAt.Format("2006-01-02T15:04:05Z07:00")
	}
	if !task.CreatedAt.IsZero() {
		eventData.CreatedAt = task.CreatedAt.Format("2006-01-02T15:04:05Z07:00")
	}
	if !task.UpdatedAt.IsZero() {
		eventData.UpdatedAt = task.UpdatedAt.Format("2006-01-02T15:04:05Z07:00")
	}

	data, err := json.Marshal(eventData)
	if err != nil {
		return fmt.Errorf("marshal task created event: %w", err)
	}

	msg := contracts.AmqpMessage{
		OrganizationID: task.OrganizationID.String(),
		UserID:         task.AssigneeID.String(),
		EventType:      contracts.TaskEventCreated,
		Data:           data,
	}

	return p.mq.PublishMessage(ctx, "task."+task.OrganizationID.String(), msg)
}

func (p *taskPublisher) TaskUpdated(ctx context.Context, task *models.Task, reporter, assignee *userpb.User) error {
	if p == nil || p.mq == nil || task == nil {
		return nil
	}

	eventData := &contracts.TaskUpdatedEvent{
		TaskID:         task.ID.String(),
		OrganizationID: task.OrganizationID.String(),
		Title:          task.Title,
		Description:    task.Description,
		Status:         task.Status,
		Priority:       task.Priority,
		AssigneeID:     task.AssigneeID.String(),
		ReporterID:     task.ReporterID.String(),
	}

	// Add reporter details if available
	if reporter != nil {
		eventData.Reporter = &contracts.TaskUser{
			ID:        reporter.Id,
			FirstName: reporter.FirstName,
			LastName:  reporter.LastName,
			Email:     reporter.Email,
		}
	}

	// Add assignee details if available
	if assignee != nil {
		eventData.Assignee = &contracts.TaskUser{
			ID:        assignee.Id,
			FirstName: assignee.FirstName,
			LastName:  assignee.LastName,
			Email:     assignee.Email,
		}
	}

	if task.DueAt != nil {
		eventData.DueAt = task.DueAt.Format("2006-01-02T15:04:05Z07:00")
	}
	if !task.UpdatedAt.IsZero() {
		eventData.UpdatedAt = task.UpdatedAt.Format("2006-01-02T15:04:05Z07:00")
	}

	data, err := json.Marshal(eventData)
	if err != nil {
		return fmt.Errorf("marshal task updated event: %w", err)
	}

	msg := contracts.AmqpMessage{
		OrganizationID: task.OrganizationID.String(),
		UserID:         task.AssigneeID.String(),
		EventType:      contracts.TaskEventUpdated,
		Data:           data,
	}

	return p.mq.PublishMessage(ctx, "task."+task.OrganizationID.String(), msg)
}

type noopTaskPublisher struct{}

func (noopTaskPublisher) TaskCreated(context.Context, *models.Task, *userpb.User, *userpb.User) error {
	return nil
}

func (noopTaskPublisher) TaskUpdated(context.Context, *models.Task, *userpb.User, *userpb.User) error {
	return nil
}
