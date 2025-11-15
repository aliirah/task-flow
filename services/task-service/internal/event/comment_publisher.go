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

// CommentEventPublisher describes the behaviour required to broadcast comment lifecycle events.
type CommentEventPublisher interface {
	CommentCreated(ctx context.Context, comment *models.Comment, task *models.Task, user *userpb.User) error
	CommentUpdated(ctx context.Context, comment *models.Comment, task *models.Task, user *userpb.User) error
	CommentDeleted(ctx context.Context, commentID, taskID, organizationID, userID string, user *userpb.User) error
}

// NewCommentPublisher builds a RabbitMQ-backed CommentEventPublisher
func NewCommentPublisher(mq *messaging.RabbitMQ) CommentEventPublisher {
	if mq == nil {
		return noopCommentPublisher{}
	}
	return &commentPublisher{mq: mq}
}

type commentPublisher struct {
	mq *messaging.RabbitMQ
}

type noopCommentPublisher struct{}

func (noopCommentPublisher) CommentCreated(ctx context.Context, comment *models.Comment, task *models.Task, user *userpb.User) error {
	return nil
}

func (noopCommentPublisher) CommentUpdated(ctx context.Context, comment *models.Comment, task *models.Task, user *userpb.User) error {
	return nil
}

func (noopCommentPublisher) CommentDeleted(ctx context.Context, commentID, taskID, organizationID, userID string, user *userpb.User) error {
	return nil
}

func (p *commentPublisher) CommentCreated(ctx context.Context, comment *models.Comment, task *models.Task, user *userpb.User) error {
	eventData := contracts.CommentCreatedEvent{
		CommentID:      comment.ID.String(),
		TaskID:         comment.TaskID.String(),
		OrganizationID: task.OrganizationID.String(),
		UserID:         comment.UserID.String(),
		Content:        comment.Content,
		MentionedUsers: comment.MentionedUsers,
		CreatedAt:      comment.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}

	if comment.ParentCommentID != nil {
		eventData.ParentCommentID = comment.ParentCommentID.String()
	}

	if user != nil {
		eventData.User = &contracts.TaskUser{
			ID:        user.Id,
			FirstName: user.FirstName,
			LastName:  user.LastName,
			Email:     user.Email,
		}
	}

	data, err := json.Marshal(eventData)
	if err != nil {
		return fmt.Errorf("marshal comment created event: %w", err)
	}

	msg := contracts.AmqpMessage{
		OrganizationID: task.OrganizationID.String(),
		UserID:         comment.UserID.String(),
		EventType:      contracts.CommentEventCreated,
		Data:           data,
	}

	return p.mq.PublishMessage(ctx, "comment."+task.OrganizationID.String(), msg)
}

func (p *commentPublisher) CommentUpdated(ctx context.Context, comment *models.Comment, task *models.Task, user *userpb.User) error {
	eventData := contracts.CommentUpdatedEvent{
		CommentID:      comment.ID.String(),
		TaskID:         comment.TaskID.String(),
		OrganizationID: task.OrganizationID.String(),
		UserID:         comment.UserID.String(),
		Content:        comment.Content,
		MentionedUsers: comment.MentionedUsers,
		UpdatedAt:      comment.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}

	if comment.ParentCommentID != nil {
		eventData.ParentCommentID = comment.ParentCommentID.String()
	}

	if user != nil {
		eventData.User = &contracts.TaskUser{
			ID:        user.Id,
			FirstName: user.FirstName,
			LastName:  user.LastName,
			Email:     user.Email,
		}
	}

	data, err := json.Marshal(eventData)
	if err != nil {
		return fmt.Errorf("marshal comment updated event: %w", err)
	}

	msg := contracts.AmqpMessage{
		OrganizationID: task.OrganizationID.String(),
		UserID:         comment.UserID.String(),
		EventType:      contracts.CommentEventUpdated,
		Data:           data,
	}

	return p.mq.PublishMessage(ctx, "comment."+task.OrganizationID.String(), msg)
}

func (p *commentPublisher) CommentDeleted(ctx context.Context, commentID, taskID, organizationID, userID string, user *userpb.User) error {
	eventData := contracts.CommentDeletedEvent{
		CommentID:      commentID,
		TaskID:         taskID,
		OrganizationID: organizationID,
		UserID:         userID,
	}

	if user != nil {
		eventData.User = &contracts.TaskUser{
			ID:        user.Id,
			FirstName: user.FirstName,
			LastName:  user.LastName,
			Email:     user.Email,
		}
	}

	data, err := json.Marshal(eventData)
	if err != nil {
		return fmt.Errorf("marshal comment deleted event: %w", err)
	}

	msg := contracts.AmqpMessage{
		OrganizationID: organizationID,
		UserID:         userID,
		EventType:      contracts.CommentEventDeleted,
		Data:           data,
	}

	return p.mq.PublishMessage(ctx, "comment."+organizationID, msg)
}
