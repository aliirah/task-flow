package contracts

import "encoding/json"

type AmqpMessage struct {
	OrganizationID string          `json:"organization_id,omitempty"`
	UserID         string          `json:"user_id,omitempty"`
	EventType      string          `json:"event_type"`
	Data           json.RawMessage `json:"data,omitempty"`
}

const (
	TaskEventCreated = "task.event.created"
	TaskEventUpdated = "task.event.updated"
	
	CommentEventCreated = "comment.event.created"
	CommentEventUpdated = "comment.event.updated"
	CommentEventDeleted = "comment.event.deleted"
)

type TaskCreatedEvent struct {
	TaskID         string    `json:"taskId"`
	OrganizationID string    `json:"organizationId"`
	Title          string    `json:"title"`
	Description    string    `json:"description"`
	Status         string    `json:"status"`
	Priority       string    `json:"priority"`
	ReporterID     string    `json:"reporterId"`
	AssigneeID     string    `json:"assigneeId"`
	Reporter       *TaskUser `json:"reporter,omitempty"`
	Assignee       *TaskUser `json:"assignee,omitempty"`
	TriggeredByID  string    `json:"triggeredById,omitempty"`
	TriggeredBy    *TaskUser `json:"triggeredBy,omitempty"`
	DueAt          string    `json:"dueAt,omitempty"`
	CreatedAt      string    `json:"createdAt,omitempty"`
	UpdatedAt      string    `json:"updatedAt,omitempty"`
}

type TaskUpdatedEvent struct {
	TaskID         string    `json:"taskId"`
	OrganizationID string    `json:"organizationId"`
	Title          string    `json:"title"`
	Description    string    `json:"description"`
	Status         string    `json:"status"`
	Priority       string    `json:"priority"`
	ReporterID     string    `json:"reporterId"`
	AssigneeID     string    `json:"assigneeId"`
	Reporter       *TaskUser `json:"reporter,omitempty"`
	Assignee       *TaskUser `json:"assignee,omitempty"`
	TriggeredByID  string    `json:"triggeredById,omitempty"`
	TriggeredBy    *TaskUser `json:"triggeredBy,omitempty"`
	DueAt          string    `json:"dueAt,omitempty"`
	UpdatedAt      string    `json:"updatedAt,omitempty"`
}

type CommentCreatedEvent struct {
	CommentID       string    `json:"commentId"`
	TaskID          string    `json:"taskId"`
	OrganizationID  string    `json:"organizationId"`
	UserID          string    `json:"userId"`
	ParentCommentID string    `json:"parentCommentId,omitempty"`
	Content         string    `json:"content"`
	MentionedUsers  []string  `json:"mentionedUsers,omitempty"`
	User            *TaskUser `json:"user,omitempty"`
	CreatedAt       string    `json:"createdAt"`
}

type CommentUpdatedEvent struct {
	CommentID       string    `json:"commentId"`
	TaskID          string    `json:"taskId"`
	OrganizationID  string    `json:"organizationId"`
	UserID          string    `json:"userId"`
	ParentCommentID string    `json:"parentCommentId,omitempty"`
	Content         string    `json:"content"`
	MentionedUsers  []string  `json:"mentionedUsers,omitempty"`
	User            *TaskUser `json:"user,omitempty"`
	UpdatedAt       string    `json:"updatedAt"`
}

type CommentDeletedEvent struct {
	CommentID      string    `json:"commentId"`
	TaskID         string    `json:"taskId"`
	OrganizationID string    `json:"organizationId"`
	UserID         string    `json:"userId"`
	User           *TaskUser `json:"user,omitempty"`
}
