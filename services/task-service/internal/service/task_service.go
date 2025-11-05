package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/aliirah/task-flow/services/task-service/internal/event"
	"github.com/aliirah/task-flow/services/task-service/internal/models"
	userpb "github.com/aliirah/task-flow/shared/proto/user/v1"
	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"gorm.io/gorm"
)

type Service struct {
	db        *gorm.DB
	publisher event.TaskEventPublisher
	userSvc   userpb.UserServiceClient
}

func New(db *gorm.DB, publisher event.TaskEventPublisher, userSvc userpb.UserServiceClient) *Service {
	return &Service{
		db:        db,
		publisher: publisher,
		userSvc:   userSvc,
	}
}

type CreateTaskInput struct {
	Title          string
	Description    string
	Status         string
	Priority       string
	OrganizationID uuid.UUID
	AssigneeID     uuid.UUID
	ReporterID     uuid.UUID
	DueAt          *time.Time
}

func (s *Service) CreateTask(ctx context.Context, input CreateTaskInput) (*models.Task, error) {
	task := &models.Task{
		Title:          strings.TrimSpace(input.Title),
		Description:    strings.TrimSpace(input.Description),
		Status:         defaultString(strings.ToLower(strings.TrimSpace(input.Status)), "open"),
		Priority:       defaultString(strings.ToLower(strings.TrimSpace(input.Priority)), "medium"),
		OrganizationID: input.OrganizationID,
		AssigneeID:     input.AssigneeID,
		ReporterID:     input.ReporterID,
		DueAt:          input.DueAt,
	}

	if err := s.db.WithContext(ctx).Create(task).Error; err != nil {
		return nil, err
	}

	// Fetch reporter details
	var reporter *userpb.User
	resp, err := s.userSvc.GetUser(ctx, &userpb.GetUserRequest{
		Id: task.ReporterID.String(),
	})
	if err != nil && status.Code(err) != codes.NotFound {
		return nil, fmt.Errorf("failed to fetch reporter details: %w", err)
	}
	if resp != nil {
		reporter = resp
	}

	// Fetch assignee details if assigned
	var assignee *userpb.User
	if task.AssigneeID != uuid.Nil {
		resp, err := s.userSvc.GetUser(ctx, &userpb.GetUserRequest{
			Id: task.AssigneeID.String(),
		})
		if err != nil && status.Code(err) != codes.NotFound {
			return nil, fmt.Errorf("failed to fetch assignee details: %w", err)
		}
		if resp != nil {
			assignee = resp
		}
	}

	// Create task with enriched user details
	if err := s.publisher.TaskCreated(ctx, task, reporter, assignee); err != nil {
		return nil, fmt.Errorf("failed to publish task created event: %w", err)
	}

	return task, nil
}

func (s *Service) GetTask(ctx context.Context, id uuid.UUID) (*models.Task, error) {
	var task models.Task
	if err := s.db.WithContext(ctx).First(&task, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &task, nil
}

type ListTasksParams struct {
	OrganizationID uuid.UUID
	AssigneeID     uuid.UUID
	ReporterID     uuid.UUID
	Status         string
	Page           int
	Limit          int
}

func (s *Service) ListTasks(ctx context.Context, params ListTasksParams) ([]models.Task, error) {
	if params.Page <= 0 {
		params.Page = 1
	}
	if params.Limit <= 0 {
		params.Limit = 20
	}
	offset := (params.Page - 1) * params.Limit

	query := s.db.WithContext(ctx).Model(&models.Task{}).Order("created_at DESC")

	if params.OrganizationID != uuid.Nil {
		query = query.Where("organization_id = ?", params.OrganizationID)
	}
	if params.AssigneeID != uuid.Nil {
		query = query.Where("assignee_id = ?", params.AssigneeID)
	}
	if params.ReporterID != uuid.Nil {
		query = query.Where("reporter_id = ?", params.ReporterID)
	}
	if params.Status != "" {
		query = query.Where("status = ?", strings.ToLower(params.Status))
	}

	var tasks []models.Task
	if err := query.Offset(offset).Limit(params.Limit).Find(&tasks).Error; err != nil {
		return nil, err
	}
	return tasks, nil
}

type UpdateTaskInput struct {
	Title          *string
	Description    *string
	Status         *string
	Priority       *string
	OrganizationID *uuid.UUID
	AssigneeID     *uuid.UUID
	ReporterID     *uuid.UUID
	DueAt          *time.Time
}

func (s *Service) UpdateTask(ctx context.Context, id uuid.UUID, input UpdateTaskInput) (*models.Task, error) {
	task, err := s.GetTask(ctx, id)
	if err != nil {
		return nil, err
	}

	updates := map[string]interface{}{}
	if input.Title != nil {
		updates["title"] = strings.TrimSpace(*input.Title)
	}
	if input.Description != nil {
		updates["description"] = strings.TrimSpace(*input.Description)
	}
	if input.Status != nil {
		updates["status"] = strings.ToLower(strings.TrimSpace(*input.Status))
	}
	if input.Priority != nil {
		updates["priority"] = strings.ToLower(strings.TrimSpace(*input.Priority))
	}
	if input.OrganizationID != nil {
		updates["organization_id"] = *input.OrganizationID
	}
	if input.AssigneeID != nil {
		updates["assignee_id"] = *input.AssigneeID
	}
	if input.ReporterID != nil {
		updates["reporter_id"] = *input.ReporterID
	}
	if input.DueAt != nil {
		updates["due_at"] = *input.DueAt
	}

	if len(updates) > 0 {
		if err := s.db.WithContext(ctx).Model(task).Updates(updates).Error; err != nil {
			return nil, err
		}
	}

	return task, nil
}

func (s *Service) DeleteTask(ctx context.Context, id uuid.UUID) error {
	return s.db.WithContext(ctx).Delete(&models.Task{}, "id = ?", id).Error
}

func defaultString(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}
