package dto

import (
	"fmt"
	"strings"
	"time"

	taskdomain "github.com/aliirah/task-flow/shared/domain/task"
	taskpb "github.com/aliirah/task-flow/shared/proto/task/v1"
	"github.com/aliirah/task-flow/shared/util/stringset"
	timestamppb "google.golang.org/protobuf/types/known/timestamppb"
	wrapperspb "google.golang.org/protobuf/types/known/wrapperspb"
)

// CreateCommentPayload is the HTTP payload for creating a comment.
type CreateCommentPayload struct {
	Content         string   `json:"content" validate:"required,min=1"`
	ParentCommentID string   `json:"parentCommentId" validate:"omitempty,uuid4"`
	MentionedUsers  []string `json:"mentionedUsers" validate:"omitempty,dive,uuid4"`
}

func (p CreateCommentPayload) Build(taskID string) *taskpb.CreateCommentRequest {
	return &taskpb.CreateCommentRequest{
		TaskId:          taskID,
		Content:         strings.TrimSpace(p.Content),
		ParentCommentId: strings.TrimSpace(p.ParentCommentID),
		MentionedUsers:  p.MentionedUsers,
	}
}

// UpdateCommentPayload is the HTTP payload for updating a comment.
type UpdateCommentPayload struct {
	Content        string   `json:"content" validate:"required,min=1"`
	MentionedUsers []string `json:"mentionedUsers" validate:"omitempty,dive,uuid4"`
}

func (p UpdateCommentPayload) Build(id string) *taskpb.UpdateCommentRequest {
	return &taskpb.UpdateCommentRequest{
		Id:             id,
		Content:        strings.TrimSpace(p.Content),
		MentionedUsers: p.MentionedUsers,
	}
}

type CreateTaskPayload struct {
	Title          string  `json:"title" validate:"required,min=3"`
	Description    string  `json:"description" validate:"omitempty,max=4096"`
	Status         string  `json:"status" validate:"omitempty"`
	Priority       string  `json:"priority" validate:"omitempty"`
	Type           string  `json:"type" validate:"omitempty,oneof=task story sub-task"`
	OrganizationID string  `json:"organizationId" validate:"required,uuid4"`
	AssigneeID     *string `json:"assigneeId" validate:"omitempty,uuid4"`
	ReporterID     *string `json:"reporterId" validate:"omitempty,uuid4"`
	ParentTaskID   *string `json:"parentTaskId" validate:"omitempty,uuid4"`
	DisplayOrder   int     `json:"displayOrder" validate:"omitempty"`
	DueAt          *string `json:"dueAt" validate:"omitempty"`
}

func (p CreateTaskPayload) Build(defaultReporterID string) (*taskpb.CreateTaskRequest, error) {
	status, err := stringset.Normalize(p.Status, "status", taskdomain.StatusSet, "open")
	if err != nil {
		return nil, err
	}
	priority, err := stringset.Normalize(p.Priority, "priority", taskdomain.PrioritySet, "medium")
	if err != nil {
		return nil, err
	}

	var dueAt *time.Time
	if p.DueAt != nil && strings.TrimSpace(*p.DueAt) != "" {
		parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(*p.DueAt))
		if err != nil {
			return nil, fmt.Errorf("invalid dueAt format, expected RFC3339")
		}
		dueAt = &parsed
	}

	reporterID := defaultReporterID
	if p.ReporterID != nil {
		trimmed := strings.TrimSpace(*p.ReporterID)
		if trimmed != "" {
			reporterID = trimmed
		}
	}

	assigneeID := ""
	if p.AssigneeID != nil {
		assigneeID = strings.TrimSpace(*p.AssigneeID)
	}

	parentTaskID := ""
	if p.ParentTaskID != nil {
		parentTaskID = strings.TrimSpace(*p.ParentTaskID)
	}

	taskType := strings.ToLower(strings.TrimSpace(p.Type))
	if taskType == "" {
		taskType = "task"
	}

	req := &taskpb.CreateTaskRequest{
		Title:          strings.TrimSpace(p.Title),
		Description:    strings.TrimSpace(p.Description),
		Status:         status,
		Priority:       priority,
		Type:           taskType,
		OrganizationId: p.OrganizationID,
		AssigneeId:     assigneeID,
		ReporterId:     reporterID,
		ParentTaskId:   parentTaskID,
		DisplayOrder:   int32(p.DisplayOrder),
	}
	if dueAt != nil {
		req.DueAt = timestamppb.New(dueAt.UTC())
	}
	return req, nil
}

type UpdateTaskPayload struct {
	Title          *string `json:"title" validate:"omitempty,min=3"`
	Description    *string `json:"description" validate:"omitempty,max=4096"`
	Status         *string `json:"status" validate:"omitempty"`
	Priority       *string `json:"priority" validate:"omitempty"`
	Type           *string `json:"type" validate:"omitempty,oneof=task story sub-task"`
	OrganizationID *string `json:"organizationId" validate:"omitempty,uuid4"`
	AssigneeID     *string `json:"assigneeId" validate:"omitempty,uuid4"`
	ReporterID     *string `json:"reporterId" validate:"omitempty,uuid4"`
	ParentTaskID   *string `json:"parentTaskId" validate:"omitempty,uuid4"`
	DisplayOrder   *int    `json:"displayOrder" validate:"omitempty"`
	DueAt          *string `json:"dueAt" validate:"omitempty"`
}

func (p UpdateTaskPayload) Build(id string) (*taskpb.UpdateTaskRequest, error) {
	req := &taskpb.UpdateTaskRequest{Id: id}

	if p.Title != nil {
		trimmed := strings.TrimSpace(*p.Title)
		if trimmed != "" {
			req.Title = wrapperspb.String(trimmed)
		}
	}
	if p.Description != nil {
		trimmed := strings.TrimSpace(*p.Description)
		if trimmed != "" {
			req.Description = wrapperspb.String(trimmed)
		}
	}
	if p.Status != nil {
		value, err := stringset.Normalize(*p.Status, "status", taskdomain.StatusSet, "")
		if err != nil {
			return nil, err
		}
		if value != "" {
			req.Status = wrapperspb.String(value)
		}
	}
	if p.Priority != nil {
		value, err := stringset.Normalize(*p.Priority, "priority", taskdomain.PrioritySet, "")
		if err != nil {
			return nil, err
		}
		if value != "" {
			req.Priority = wrapperspb.String(value)
		}
	}
	if p.Type != nil {
		taskType := strings.ToLower(strings.TrimSpace(*p.Type))
		if taskType != "" {
			req.Type = wrapperspb.String(taskType)
		}
	}
	if p.OrganizationID != nil {
		trimmed := strings.TrimSpace(*p.OrganizationID)
		if trimmed != "" {
			req.OrganizationId = wrapperspb.String(trimmed)
		}
	}
	if p.AssigneeID != nil {
		trimmed := strings.TrimSpace(*p.AssigneeID)
		if trimmed != "" {
			req.AssigneeId = wrapperspb.String(trimmed)
		}
	}
	if p.ReporterID != nil {
		trimmed := strings.TrimSpace(*p.ReporterID)
		if trimmed != "" {
			req.ReporterId = wrapperspb.String(trimmed)
		}
	}
	if p.ParentTaskID != nil {
		trimmed := strings.TrimSpace(*p.ParentTaskID)
		if trimmed != "" {
			req.ParentTaskId = wrapperspb.String(trimmed)
		}
	}
	if p.DisplayOrder != nil {
		req.DisplayOrder = wrapperspb.Int32(int32(*p.DisplayOrder))
	}
	if p.DueAt != nil && strings.TrimSpace(*p.DueAt) != "" {
		parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(*p.DueAt))
		if err != nil {
			return nil, fmt.Errorf("invalid dueAt format, expected RFC3339")
		}
		req.DueAt = timestamppb.New(parsed.UTC())
	}

	return req, nil
}

type TaskOrderItem struct {
	ID           string `json:"id" validate:"required,uuid4"`
	DisplayOrder int    `json:"displayOrder" validate:"gte=0"`
}

type ReorderTasksPayload struct {
	OrganizationID string          `json:"organizationId" validate:"required,uuid4"`
	Tasks          []TaskOrderItem `json:"tasks" validate:"required,dive"`
}

func (p ReorderTasksPayload) Build() (*taskpb.ReorderTasksRequest, error) {
	tasks := make([]*taskpb.TaskOrder, len(p.Tasks))
	for i, task := range p.Tasks {
		tasks[i] = &taskpb.TaskOrder{
			Id:           task.ID,
			DisplayOrder: int32(task.DisplayOrder),
		}
	}

	return &taskpb.ReorderTasksRequest{
		OrganizationId: p.OrganizationID,
		Tasks:          tasks,
	}, nil
}
