package consumer

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	"github.com/aliirah/task-flow/services/search-service/internal/search"
	"github.com/aliirah/task-flow/shared/contracts"
	log "github.com/aliirah/task-flow/shared/logging"
	"github.com/aliirah/task-flow/shared/messaging"
	amqp "github.com/rabbitmq/amqp091-go"
)

type Consumer struct {
	rabbit *messaging.RabbitMQ
	search *search.Service
}

func New(rabbit *messaging.RabbitMQ, searchSvc *search.Service) *Consumer {
	return &Consumer{
		rabbit: rabbit,
		search: searchSvc,
	}
}

func (c *Consumer) Start() error {
	if c.rabbit == nil {
		return fmt.Errorf("rabbitmq not initialised")
	}

	go func() {
		if err := c.rabbit.ConsumeMessages(messaging.TaskSearchEventsQueue, c.handleTaskEvent); err != nil {
			log.S().Errorw("task search consumer stopped", "error", err)
		}
	}()

	go func() {
		if err := c.rabbit.ConsumeMessages(messaging.CommentSearchEventsQueue, c.handleCommentEvent); err != nil {
			log.S().Errorw("comment search consumer stopped", "error", err)
		}
	}()

	go func() {
		if err := c.rabbit.ConsumeMessages(messaging.UserEventsQueue, c.handleUserEvent); err != nil {
			log.S().Errorw("user search consumer stopped", "error", err)
		}
	}()

	return nil
}

func (c *Consumer) handleTaskEvent(ctx context.Context, msg amqp.Delivery) error {
	var amqpMsg contracts.AmqpMessage
	if err := json.Unmarshal(msg.Body, &amqpMsg); err != nil {
		return fmt.Errorf("unmarshal task amqp message: %w", err)
	}

	switch amqpMsg.EventType {
	case contracts.TaskEventCreated:
		var event contracts.TaskCreatedEvent
		if err := json.Unmarshal(amqpMsg.Data, &event); err != nil {
			return fmt.Errorf("unmarshal task created event: %w", err)
		}
		doc := mapTaskToDocument(event.TaskID, event.OrganizationID, event.Title, event.Description, event.Assignee, event.Reporter)
		return c.search.UpsertDocument(ctx, doc)
	case contracts.TaskEventUpdated:
		var event contracts.TaskUpdatedEvent
		if err := json.Unmarshal(amqpMsg.Data, &event); err != nil {
			return fmt.Errorf("unmarshal task updated event: %w", err)
		}
		doc := mapTaskToDocument(event.TaskID, event.OrganizationID, event.Title, event.Description, event.Assignee, event.Reporter)
		return c.search.UpsertDocument(ctx, doc)
	case contracts.TaskEventDeleted:
		var event contracts.TaskDeletedEvent
		if err := json.Unmarshal(amqpMsg.Data, &event); err != nil {
			return fmt.Errorf("unmarshal task deleted event: %w", err)
		}
		return c.search.DeleteDocument(ctx, search.DocumentTypeTask, event.TaskID)
	default:
		return nil
	}
}

func (c *Consumer) handleCommentEvent(ctx context.Context, msg amqp.Delivery) error {
	var amqpMsg contracts.AmqpMessage
	if err := json.Unmarshal(msg.Body, &amqpMsg); err != nil {
		return fmt.Errorf("unmarshal comment amqp message: %w", err)
	}

	switch amqpMsg.EventType {
	case contracts.CommentEventCreated:
		var event contracts.CommentCreatedEvent
		if err := json.Unmarshal(amqpMsg.Data, &event); err != nil {
			return fmt.Errorf("unmarshal comment created event: %w", err)
		}
		doc := mapCommentToDocument(event.CommentID, event.TaskID, event.OrganizationID, event.Content, event.User)
		return c.search.UpsertDocument(ctx, doc)
	case contracts.CommentEventUpdated:
		var event contracts.CommentUpdatedEvent
		if err := json.Unmarshal(amqpMsg.Data, &event); err != nil {
			return fmt.Errorf("unmarshal comment updated event: %w", err)
		}
		doc := mapCommentToDocument(event.CommentID, event.TaskID, event.OrganizationID, event.Content, event.User)
		return c.search.UpsertDocument(ctx, doc)
	case contracts.CommentEventDeleted:
		var event contracts.CommentDeletedEvent
		if err := json.Unmarshal(amqpMsg.Data, &event); err != nil {
			return fmt.Errorf("unmarshal comment deleted event: %w", err)
		}
		return c.search.DeleteDocument(ctx, search.DocumentTypeComment, event.CommentID)
	default:
		return nil
	}
}

func (c *Consumer) handleUserEvent(ctx context.Context, msg amqp.Delivery) error {
	var amqpMsg contracts.AmqpMessage
	if err := json.Unmarshal(msg.Body, &amqpMsg); err != nil {
		return fmt.Errorf("unmarshal user amqp message: %w", err)
	}

	switch amqpMsg.EventType {
	case contracts.UserEventCreated, contracts.UserEventUpdated:
		var event contracts.UserEvent
		if err := json.Unmarshal(amqpMsg.Data, &event); err != nil {
			return fmt.Errorf("unmarshal user event: %w", err)
		}
		doc := mapUserToDocument(event)
		return c.search.UpsertDocument(ctx, doc)
	case contracts.UserEventDeleted:
		var event contracts.UserEvent
		if err := json.Unmarshal(amqpMsg.Data, &event); err != nil {
			return fmt.Errorf("unmarshal user deleted event: %w", err)
		}
		return c.search.DeleteDocument(ctx, search.DocumentTypeUser, event.UserID)
	default:
		return nil
	}
}

func mapTaskToDocument(taskID, orgID, title, description string, assignee, reporter *contracts.TaskUser) search.Document {
	metadata := map[string]string{}
	if assignee != nil {
		metadata["assignee"] = fmt.Sprintf("%s %s", assignee.FirstName, assignee.LastName)
	}
	if reporter != nil {
		metadata["reporter"] = fmt.Sprintf("%s %s", reporter.FirstName, reporter.LastName)
	}

	return search.Document{
		ID:             taskID,
		Type:           search.DocumentTypeTask,
		Title:          title,
		Summary:        description,
		Content:        description,
		OrganizationID: orgID,
		TaskID:         taskID,
		Metadata:       metadata,
	}
}

func mapCommentToDocument(commentID, taskID, orgID, content string, user *contracts.TaskUser) search.Document {
	title := "Comment"
	if user != nil {
		title = fmt.Sprintf("Comment by %s %s", user.FirstName, user.LastName)
	}

	doc := search.Document{
		ID:             commentID,
		Type:           search.DocumentTypeComment,
		Title:          title,
		Summary:        sanitizeContent(content),
		Content:        sanitizeContent(content),
		OrganizationID: orgID,
		TaskID:         taskID,
	}
	if user != nil {
		doc.UserID = user.ID
		doc.Metadata = map[string]string{
			"userEmail": user.Email,
		}
	}
	return doc
}

func mapUserToDocument(event contracts.UserEvent) search.Document {
	title := strings.TrimSpace(fmt.Sprintf("%s %s", event.FirstName, event.LastName))
	if title == "" {
		title = event.Email
	}

	doc := search.Document{
		ID:      event.UserID,
		Type:    search.DocumentTypeUser,
		Title:   title,
		Summary: event.Email,
		Email:   event.Email,
		UserID:  event.UserID,
		Metadata: map[string]string{
			"status":   event.Status,
			"userType": event.UserType,
		},
	}
	if len(event.Roles) > 0 {
		if doc.Metadata == nil {
			doc.Metadata = map[string]string{}
		}
		doc.Metadata["roles"] = strings.Join(event.Roles, ",")
	}
	return doc
}

var htmlStripper = regexp.MustCompile(`<[^>]*>`)

func sanitizeContent(value string) string {
	if value == "" {
		return ""
	}
	text := htmlStripper.ReplaceAllString(value, " ")
	return strings.TrimSpace(strings.Join(strings.Fields(text), " "))
}
