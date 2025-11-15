package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/aliirah/task-flow/services/task-service/internal/event"
	"github.com/aliirah/task-flow/services/task-service/internal/models"
	"github.com/aliirah/task-flow/shared/authctx"
	"github.com/aliirah/task-flow/shared/contracts"
	"github.com/aliirah/task-flow/shared/messaging"
	organizationpb "github.com/aliirah/task-flow/shared/proto/organization/v1"
	userpb "github.com/aliirah/task-flow/shared/proto/user/v1"
	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"gorm.io/gorm"
)

type Service struct {
	db               *gorm.DB
	publisher        event.TaskEventPublisher
	commentPublisher event.CommentEventPublisher
	notifPublisher   *messaging.NotificationPublisher
	userSvc          userpb.UserServiceClient
	orgSvc           organizationpb.OrganizationServiceClient
}

func New(db *gorm.DB, publisher event.TaskEventPublisher, commentPublisher event.CommentEventPublisher, notifPublisher *messaging.NotificationPublisher, userSvc userpb.UserServiceClient, orgSvc organizationpb.OrganizationServiceClient) *Service {
	return &Service{
		db:               db,
		publisher:        publisher,
		commentPublisher: commentPublisher,
		notifPublisher:   notifPublisher,
		userSvc:          userSvc,
		orgSvc:           orgSvc,
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

func (s *Service) CreateTask(ctx context.Context, input CreateTaskInput, initiator authctx.User) (*models.Task, error) {
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
	triggeredBy := taskUserFromAuth(initiator)
	if triggeredBy == nil {
		triggeredBy = reporterTaskUserFallback(task.ReporterID, reporter)
	}

	if err := s.publisher.TaskCreated(ctx, task, reporter, assignee, triggeredBy); err != nil {
		return nil, fmt.Errorf("failed to publish task created event: %w", err)
	}

	// Publish notification event
	recipients := []uuid.UUID{}
	initiatorUUID, _ := uuid.Parse(initiator.ID)
	if task.AssigneeID != uuid.Nil && task.AssigneeID != initiatorUUID {
		recipients = append(recipients, task.AssigneeID)
	}
	if task.ReporterID != uuid.Nil && task.ReporterID != initiatorUUID && task.ReporterID != task.AssigneeID {
		recipients = append(recipients, task.ReporterID)
	}

	if len(recipients) > 0 {
		// Convert UUIDs to strings
		recipientStrs := make([]string, len(recipients))
		for i, id := range recipients {
			recipientStrs[i] = id.String()
		}

		taskData := &contracts.TaskNotificationData{
			TaskID:      task.ID.String(),
			Title:       task.Title,
			Description: task.Description,
			Status:      task.Status,
			Priority:    task.Priority,
			TriggerUser: triggeredBy,
		}
		if assignee != nil {
			taskData.Assignee = &contracts.TaskUser{
				ID:        assignee.Id,
				FirstName: assignee.FirstName,
				LastName:  assignee.LastName,
				Email:     assignee.Email,
			}
		}
		if reporter != nil {
			taskData.Reporter = &contracts.TaskUser{
				ID:        reporter.Id,
				FirstName: reporter.FirstName,
				LastName:  reporter.LastName,
				Email:     reporter.Email,
			}
		}
		if err := s.notifPublisher.PublishTaskDeleted(ctx, task.OrganizationID.String(), initiator.ID, recipientStrs, taskData); err != nil {
			// Log error but don't fail the operation
			fmt.Printf("failed to publish task deleted notification: %v\n", err)
		}
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
	SortBy         string
	SortOrder      string
	Search         string
}

func (s *Service) ListTasks(ctx context.Context, params ListTasksParams) ([]models.Task, error) {
	if params.Page <= 0 {
		params.Page = 1
	}
	if params.Limit <= 0 {
		params.Limit = 10
	}
	offset := (params.Page - 1) * params.Limit

	query := s.db.WithContext(ctx).Model(&models.Task{})

	// Apply filters
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

	// Apply search - search in title and description
	if params.Search != "" {
		searchPattern := "%" + params.Search + "%"
		query = query.Where("title ILIKE ? OR description ILIKE ?", searchPattern, searchPattern)
	}

	// Apply sorting
	allowedSortFields := map[string]string{
		"title":     "title",
		"status":    "status",
		"priority":  "priority",
		"dueAt":     "due_at",
		"createdAt": "created_at",
		"updatedAt": "updated_at",
	}

	sortField := "created_at"
	if params.SortBy != "" {
		if dbField, ok := allowedSortFields[params.SortBy]; ok {
			sortField = dbField
		}
	}

	sortOrder := "DESC"
	if params.SortOrder != "" {
		if strings.ToUpper(params.SortOrder) == "ASC" {
			sortOrder = "ASC"
		}
	}

	query = query.Order(sortField + " " + sortOrder)

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

func (s *Service) UpdateTask(ctx context.Context, id uuid.UUID, input UpdateTaskInput, initiator authctx.User) (*models.Task, error) {
	task, err := s.GetTask(ctx, id)
	if err != nil {
		return nil, err
	}

	// Track changes for notifications
	oldAssigneeID := task.AssigneeID
	type fieldChange struct {
		Field string
		Old   string
		New   string
	}
	changes := []fieldChange{}

	updates := map[string]interface{}{}
	if input.Title != nil {
		newTitle := strings.TrimSpace(*input.Title)
		if newTitle != task.Title {
			changes = append(changes, fieldChange{
				Field: "title",
				Old:   task.Title,
				New:   newTitle,
			})
		}
		updates["title"] = newTitle
	}
	if input.Description != nil {
		newDesc := strings.TrimSpace(*input.Description)
		if newDesc != task.Description {
			changes = append(changes, fieldChange{
				Field: "description",
				Old:   task.Description,
				New:   newDesc,
			})
		}
		updates["description"] = newDesc
	}
	if input.Status != nil {
		newStatus := strings.ToLower(strings.TrimSpace(*input.Status))
		if newStatus != task.Status {
			changes = append(changes, fieldChange{
				Field: "status",
				Old:   task.Status,
				New:   newStatus,
			})
		}
		updates["status"] = newStatus
	}
	if input.Priority != nil {
		newPriority := strings.ToLower(strings.TrimSpace(*input.Priority))
		if newPriority != task.Priority {
			changes = append(changes, fieldChange{
				Field: "priority",
				Old:   task.Priority,
				New:   newPriority,
			})
		}
		updates["priority"] = newPriority
	}
	if input.OrganizationID != nil {
		updates["organization_id"] = *input.OrganizationID
	}
	if input.AssigneeID != nil {
		if *input.AssigneeID != task.AssigneeID {
			changes = append(changes, fieldChange{
				Field: "assignee",
				Old:   task.AssigneeID.String(),
				New:   input.AssigneeID.String(),
			})
		}
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

		// Reload the task to get the updated data
		if err := s.db.WithContext(ctx).First(task, "id = ?", id).Error; err != nil {
			return nil, fmt.Errorf("failed to reload task after update: %w", err)
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

		// Publish task updated event with enriched user details
		triggeredBy := taskUserFromAuth(initiator)
		if triggeredBy == nil {
			triggeredBy = reporterTaskUserFallback(task.ReporterID, reporter)
		}

		if err := s.publisher.TaskUpdated(ctx, task, reporter, assignee, triggeredBy); err != nil {
			return nil, fmt.Errorf("failed to publish task updated event: %w", err)
		} // Publish notification event
		recipients := []uuid.UUID{}
		initiatorUUID, _ := uuid.Parse(initiator.ID)
		if task.AssigneeID != uuid.Nil && task.AssigneeID != initiatorUUID {
			recipients = append(recipients, task.AssigneeID)
		}
		if task.ReporterID != uuid.Nil && task.ReporterID != initiatorUUID && task.ReporterID != task.AssigneeID {
			recipients = append(recipients, task.ReporterID)
		}
		// If assignee changed, also notify the old assignee
		if oldAssigneeID != uuid.Nil && oldAssigneeID != task.AssigneeID && oldAssigneeID != initiatorUUID {
			recipients = append(recipients, oldAssigneeID)
		}

		// Add all mentioned users from comments
		recipientSet := make(map[uuid.UUID]bool)
		for _, recipient := range recipients {
			recipientSet[recipient] = true
		}

		for _, mentionedUserIDStr := range task.MentionedUsers {
			mentionedUserID, err := uuid.Parse(mentionedUserIDStr)
			if err == nil && mentionedUserID != initiatorUUID && !recipientSet[mentionedUserID] {
				recipients = append(recipients, mentionedUserID)
				recipientSet[mentionedUserID] = true
			}
		}

		if len(recipients) > 0 && len(changes) > 0 {
			// Convert UUIDs to strings
			recipientStrs := make([]string, len(recipients))
			for i, id := range recipients {
				recipientStrs[i] = id.String()
			}

			// Build TaskChanges from changes slice
			taskChanges := &contracts.TaskChanges{}
			for _, change := range changes {
				fc := &contracts.FieldChange{
					Old: change.Old,
					New: change.New,
				}
				switch change.Field {
				case "title":
					taskChanges.Title = fc
				case "description":
					taskChanges.Description = fc
				case "status":
					taskChanges.Status = fc
				case "priority":
					taskChanges.Priority = fc
				case "assignee":
					taskChanges.AssigneeID = fc
				}
			}

			taskData := &contracts.TaskNotificationData{
				TaskID:      task.ID.String(),
				Title:       task.Title,
				Description: task.Description,
				Status:      task.Status,
				Priority:    task.Priority,
				TriggerUser: triggeredBy,
				Changes:     taskChanges,
			}
			if assignee != nil {
				taskData.Assignee = &contracts.TaskUser{
					ID:        assignee.Id,
					FirstName: assignee.FirstName,
					LastName:  assignee.LastName,
					Email:     assignee.Email,
				}
			}
			if reporter != nil {
				taskData.Reporter = &contracts.TaskUser{
					ID:        reporter.Id,
					FirstName: reporter.FirstName,
					LastName:  reporter.LastName,
					Email:     reporter.Email,
				}
			}
			if err := s.notifPublisher.PublishTaskUpdated(ctx, task.OrganizationID.String(), initiator.ID, recipientStrs, taskData); err != nil {
				// Log error but don't fail the operation
				fmt.Printf("failed to publish task updated notification: %v\n", err)
			}
		}
	}

	return task, nil
}

func (s *Service) DeleteTask(ctx context.Context, id uuid.UUID, initiator authctx.User) error {
	// Fetch task before deletion for notification
	task, err := s.GetTask(ctx, id)
	if err != nil {
		return err
	}

	// Fetch reporter and assignee details for notification
	var reporter *userpb.User
	resp, err := s.userSvc.GetUser(ctx, &userpb.GetUserRequest{
		Id: task.ReporterID.String(),
	})
	if err == nil && resp != nil {
		reporter = resp
	}

	var assignee *userpb.User
	if task.AssigneeID != uuid.Nil {
		resp, err := s.userSvc.GetUser(ctx, &userpb.GetUserRequest{
			Id: task.AssigneeID.String(),
		})
		if err == nil && resp != nil {
			assignee = resp
		}
	}

	// Delete the task
	if err := s.db.WithContext(ctx).Delete(&models.Task{}, "id = ?", id).Error; err != nil {
		return err
	}

	// Publish notification event
	recipients := []uuid.UUID{}
	initiatorUUID, _ := uuid.Parse(initiator.ID)
	if task.AssigneeID != uuid.Nil && task.AssigneeID != initiatorUUID {
		recipients = append(recipients, task.AssigneeID)
	}
	if task.ReporterID != uuid.Nil && task.ReporterID != initiatorUUID && task.ReporterID != task.AssigneeID {
		recipients = append(recipients, task.ReporterID)
	}

	if len(recipients) > 0 {
		// Convert UUIDs to strings
		recipientStrs := make([]string, len(recipients))
		for i, id := range recipients {
			recipientStrs[i] = id.String()
		}

		triggeredBy := taskUserFromAuth(initiator)
		if triggeredBy == nil {
			triggeredBy = reporterTaskUserFallback(task.ReporterID, reporter)
		}

		taskData := &contracts.TaskNotificationData{
			TaskID:      task.ID.String(),
			Title:       task.Title,
			Description: task.Description,
			Status:      task.Status,
			Priority:    task.Priority,
			TriggerUser: triggeredBy,
		}
		if assignee != nil {
			taskData.Assignee = &contracts.TaskUser{
				ID:        assignee.Id,
				FirstName: assignee.FirstName,
				LastName:  assignee.LastName,
				Email:     assignee.Email,
			}
		}
		if reporter != nil {
			taskData.Reporter = &contracts.TaskUser{
				ID:        reporter.Id,
				FirstName: reporter.FirstName,
				LastName:  reporter.LastName,
				Email:     reporter.Email,
			}
		}
		if err := s.notifPublisher.PublishTaskDeleted(ctx, task.OrganizationID.String(), initiator.ID, recipientStrs, taskData); err != nil {
			// Log error but don't fail the operation
			fmt.Printf("failed to publish task deleted notification: %v\n", err)
		}
	}

	return nil
}

func defaultString(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}

func taskUserFromAuth(user authctx.User) *contracts.TaskUser {
	if user.ID == "" {
		return nil
	}
	return &contracts.TaskUser{
		ID:        user.ID,
		FirstName: user.FirstName,
		LastName:  user.LastName,
		Email:     user.Email,
	}
}

func reporterTaskUserFallback(reporterID uuid.UUID, reporter *userpb.User) *contracts.TaskUser {
	if reporter != nil {
		return &contracts.TaskUser{
			ID:        reporter.Id,
			FirstName: reporter.FirstName,
			LastName:  reporter.LastName,
			Email:     reporter.Email,
		}
	}
	if reporterID == uuid.Nil {
		return nil
	}
	return &contracts.TaskUser{ID: reporterID.String()}
}

func assigneeNameOrEmpty(assignee *userpb.User) string {
	if assignee == nil {
		return ""
	}
	return fmt.Sprintf("%s %s", assignee.FirstName, assignee.LastName)
}

func reporterNameOrEmpty(reporter *userpb.User) string {
	if reporter == nil {
		return ""
	}
	return fmt.Sprintf("%s %s", reporter.FirstName, reporter.LastName)
}

// ValidateOrganizationMembership checks if a user is a member of an organization
func (s *Service) ValidateOrganizationMembership(ctx context.Context, userID uuid.UUID, organizationID uuid.UUID) error {
	if s.orgSvc == nil {
		return fmt.Errorf("organization service not available")
	}

	resp, err := s.orgSvc.ListUserMemberships(ctx, &organizationpb.ListUserMembershipsRequest{
		UserId: userID.String(),
	})
	if err != nil {
		if status.Code(err) == codes.NotFound {
			return fmt.Errorf("user is not a member of this organization")
		}
		return fmt.Errorf("failed to check organization membership: %w", err)
	}

	// Check if user is a member of the specified organization
	for _, membership := range resp.GetMemberships() {
		if membership.GetOrganizationId() == organizationID.String() {
			return nil // User is a member
		}
	}

	return fmt.Errorf("user is not a member of this organization")
}
