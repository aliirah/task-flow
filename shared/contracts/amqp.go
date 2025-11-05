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
	DueAt          string    `json:"dueAt,omitempty"`
	UpdatedAt      string    `json:"updatedAt,omitempty"`
}
