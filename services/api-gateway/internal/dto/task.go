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

type CreateTaskPayload struct {
	Title          string  `json:"title" validate:"required,min=3"`
	Description    string  `json:"description" validate:"omitempty,max=4096"`
	Status         string  `json:"status" validate:"omitempty"`
	Priority       string  `json:"priority" validate:"omitempty"`
	OrganizationID string  `json:"organizationId" validate:"required,uuid4"`
	AssigneeID     string  `json:"assigneeId" validate:"omitempty,uuid4"`
	ReporterID     string  `json:"reporterId" validate:"omitempty,uuid4"`
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

	reporterID := strings.TrimSpace(p.ReporterID)
	if reporterID == "" {
		reporterID = defaultReporterID
	}

	req := &taskpb.CreateTaskRequest{
		Title:          strings.TrimSpace(p.Title),
		Description:    strings.TrimSpace(p.Description),
		Status:         status,
		Priority:       priority,
		OrganizationId: p.OrganizationID,
		AssigneeId:     p.AssigneeID,
		ReporterId:     reporterID,
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
	OrganizationID *string `json:"organizationId" validate:"omitempty,uuid4"`
	AssigneeID     *string `json:"assigneeId" validate:"omitempty,uuid4"`
	ReporterID     *string `json:"reporterId" validate:"omitempty,uuid4"`
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
	if p.DueAt != nil && strings.TrimSpace(*p.DueAt) != "" {
		parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(*p.DueAt))
		if err != nil {
			return nil, fmt.Errorf("invalid dueAt format, expected RFC3339")
		}
		req.DueAt = timestamppb.New(parsed.UTC())
	}

	return req, nil
}
