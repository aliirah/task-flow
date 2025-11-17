package event

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/aliirah/task-flow/services/user-service/internal/models"
	"github.com/aliirah/task-flow/shared/contracts"
	"github.com/aliirah/task-flow/shared/messaging"
)

type UserEventPublisher interface {
	UserCreated(ctx context.Context, user *models.User) error
	UserUpdated(ctx context.Context, user *models.User) error
	UserDeleted(ctx context.Context, user *models.User) error
}

type userPublisher struct {
	mq *messaging.RabbitMQ
}

func NewUserPublisher(mq *messaging.RabbitMQ) UserEventPublisher {
	if mq == nil {
		return noopUserPublisher{}
	}
	return &userPublisher{mq: mq}
}

func (p *userPublisher) UserCreated(ctx context.Context, user *models.User) error {
	return p.publish(ctx, contracts.UserEventCreated, user, "")
}

func (p *userPublisher) UserUpdated(ctx context.Context, user *models.User) error {
	return p.publish(ctx, contracts.UserEventUpdated, user, "")
}

func (p *userPublisher) UserDeleted(ctx context.Context, user *models.User) error {
	return p.publish(ctx, contracts.UserEventDeleted, user, time.Now().UTC().Format(time.RFC3339))
}

func (p *userPublisher) publish(ctx context.Context, eventType string, user *models.User, deletedAt string) error {
	if p == nil || p.mq == nil || user == nil {
		return nil
	}

	event := buildUserEvent(user)
	event.DeletedAt = deletedAt

	data, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("marshal user event: %w", err)
	}

	msg := contracts.AmqpMessage{
		UserID:    user.ID.String(),
		EventType: eventType,
		Data:      data,
	}

	return p.mq.PublishMessage(ctx, "user.events", msg)
}

type noopUserPublisher struct{}

func (noopUserPublisher) UserCreated(context.Context, *models.User) error { return nil }
func (noopUserPublisher) UserUpdated(context.Context, *models.User) error { return nil }
func (noopUserPublisher) UserDeleted(context.Context, *models.User) error { return nil }

func buildUserEvent(user *models.User) contracts.UserEvent {
	event := contracts.UserEvent{
		UserID:    user.ID.String(),
		Email:     user.Email,
		FirstName: user.FirstName,
		LastName:  user.LastName,
		Status:    user.Status,
		UserType:  user.UserType,
	}

	if !user.CreatedAt.IsZero() {
		event.CreatedAt = user.CreatedAt.Format(time.RFC3339)
	}
	if !user.UpdatedAt.IsZero() {
		event.UpdatedAt = user.UpdatedAt.Format(time.RFC3339)
	}

	if len(user.Roles) > 0 {
		roles := make([]string, 0, len(user.Roles))
		for _, role := range user.Roles {
			roles = append(roles, role.Name)
		}
		event.Roles = roles
	}

	return event
}
