package reindexer

import (
	"context"
	"fmt"

	"github.com/aliirah/task-flow/services/search-service/internal/search"
	taskpb "github.com/aliirah/task-flow/shared/proto/task/v1"
	userpb "github.com/aliirah/task-flow/shared/proto/user/v1"
)

type Reindexer struct {
	search     *search.Service
	taskClient taskpb.TaskServiceClient
	userClient userpb.UserServiceClient
}

func New(searchSvc *search.Service, taskClient taskpb.TaskServiceClient, userClient userpb.UserServiceClient) *Reindexer {
	return &Reindexer{
		search:     searchSvc,
		taskClient: taskClient,
		userClient: userClient,
	}
}

func (r *Reindexer) Reindex(ctx context.Context, types []search.DocumentType) error {
	if len(types) == 0 {
		types = []search.DocumentType{
			search.DocumentTypeTask,
			search.DocumentTypeComment,
			search.DocumentTypeUser,
		}
	}

	includeTask := false
	includeComment := false
	includeUser := false
	for _, t := range types {
		switch t {
		case search.DocumentTypeTask:
			includeTask = true
		case search.DocumentTypeComment:
			includeComment = true
		case search.DocumentTypeUser:
			includeUser = true
		}
	}

	var tasks map[string]*taskpb.Task
	var err error

	if includeTask || includeComment {
		tasks, err = r.reindexTasks(ctx)
		if err != nil {
			return err
		}
	}

	if includeComment {
		if err := r.reindexComments(ctx, tasks); err != nil {
			return err
		}
	}

	if includeUser {
		if err := r.reindexUsers(ctx); err != nil {
			return err
		}
	}

	return nil
}

func (r *Reindexer) reindexTasks(ctx context.Context) (map[string]*taskpb.Task, error) {
	result := make(map[string]*taskpb.Task)
	if r.taskClient == nil {
		return result, fmt.Errorf("task client not configured")
	}

	page := int32(1)
	limit := int32(200)

	for {
		resp, err := r.taskClient.ListTasks(ctx, &taskpb.ListTasksRequest{
			Page:  page,
			Limit: limit,
		})
		if err != nil {
			return nil, fmt.Errorf("list tasks: %w", err)
		}
		if len(resp.Items) == 0 {
			break
		}

		for _, task := range resp.Items {
			result[task.Id] = task
			doc := search.Document{
				ID:             task.Id,
				Type:           search.DocumentTypeTask,
				Title:          task.Title,
				Summary:        task.Description,
				Content:        task.Description,
				OrganizationID: task.OrganizationId,
				TaskID:         task.Id,
				Metadata: map[string]string{
					"status":   task.Status,
					"priority": task.Priority,
				},
			}
			if err := r.search.UpsertDocument(ctx, doc); err != nil {
				return nil, fmt.Errorf("index task %s: %w", task.Id, err)
			}
		}

		if int32(len(resp.Items)) < limit {
			break
		}
		page++
	}

	return result, nil
}

func (r *Reindexer) reindexComments(ctx context.Context, tasks map[string]*taskpb.Task) error {
	if r.taskClient == nil {
		return fmt.Errorf("task client not configured")
	}

	for taskID, task := range tasks {
		page := int32(1)
		limit := int32(200)

		for {
			resp, err := r.taskClient.ListComments(ctx, &taskpb.ListCommentsRequest{
				TaskId: taskID,
				Page:   page,
				Limit:  limit,
			})
			if err != nil {
				return fmt.Errorf("list comments for task %s: %w", taskID, err)
			}

			if len(resp.Items) == 0 {
				break
			}

			for _, comment := range resp.Items {
				doc := search.Document{
					ID:             comment.Id,
					Type:           search.DocumentTypeComment,
					Title:          fmt.Sprintf("Comment on %s", task.Title),
					Summary:        comment.Content,
					Content:        comment.Content,
					OrganizationID: task.OrganizationId,
					TaskID:         taskID,
					UserID:         comment.UserId,
				}
				if err := r.search.UpsertDocument(ctx, doc); err != nil {
					return fmt.Errorf("index comment %s: %w", comment.Id, err)
				}
			}

			if int32(len(resp.Items)) < limit {
				break
			}
			page++
		}
	}

	return nil
}

func (r *Reindexer) reindexUsers(ctx context.Context) error {
	if r.userClient == nil {
		return fmt.Errorf("user client not configured")
	}

	page := int32(1)
	limit := int32(200)

	for {
		resp, err := r.userClient.ListUsers(ctx, &userpb.ListUsersRequest{
			Page:  page,
			Limit: limit,
		})
		if err != nil {
			return fmt.Errorf("list users: %w", err)
		}

		if len(resp.Items) == 0 {
			break
		}

		for _, user := range resp.Items {
			doc := search.Document{
				ID:      user.Id,
				Type:    search.DocumentTypeUser,
				Title:   fmt.Sprintf("%s %s", user.FirstName, user.LastName),
				Summary: user.Email,
				Email:   user.Email,
				UserID:  user.Id,
				Metadata: map[string]string{
					"status":   user.Status,
					"userType": user.UserType,
				},
			}
			if err := r.search.UpsertDocument(ctx, doc); err != nil {
				return fmt.Errorf("index user %s: %w", user.Id, err)
			}
		}

		if int32(len(resp.Items)) < limit {
			break
		}
		page++
	}

	return nil
}
