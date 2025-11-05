package service

import (
	"context"
	"errors"

	"github.com/gin-gonic/gin"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	organizationpb "github.com/aliirah/task-flow/shared/proto/organization/v1"
	taskpb "github.com/aliirah/task-flow/shared/proto/task/v1"
	userpb "github.com/aliirah/task-flow/shared/proto/user/v1"
	tasktransform "github.com/aliirah/task-flow/shared/transform/task"
	"github.com/aliirah/task-flow/shared/util/collections"
)

// TaskService exposes task RPCs behind a gateway-friendly interface.
type TaskService interface {
	Create(ctx context.Context, req *taskpb.CreateTaskRequest) (*taskpb.Task, error)
	Get(ctx context.Context, id string) (*taskpb.Task, error)
	List(ctx context.Context, req *taskpb.ListTasksRequest) (*taskpb.ListTasksResponse, error)
	Update(ctx context.Context, req *taskpb.UpdateTaskRequest) (*taskpb.Task, error)
	Delete(ctx context.Context, id string) error
	BuildView(ctx context.Context, tasks []*taskpb.Task) ([]gin.H, error)
}

type taskService struct {
	client      taskpb.TaskServiceClient
	userService UserService
	orgService  OrganizationService
}

// NewTaskService constructs a TaskService backed by the given gRPC client.
func NewTaskService(client taskpb.TaskServiceClient, userSvc UserService, orgSvc OrganizationService) TaskService {
	return &taskService{client: client, userService: userSvc, orgService: orgSvc}
}

func (s *taskService) Create(ctx context.Context, req *taskpb.CreateTaskRequest) (*taskpb.Task, error) {
	if s.client == nil {
		return nil, errors.New("task service client not configured")
	}
	ctx = withOutgoingAuth(ctx)
	return s.client.CreateTask(ctx, req)
}

func (s *taskService) Get(ctx context.Context, id string) (*taskpb.Task, error) {
	if s.client == nil {
		return nil, errors.New("task service client not configured")
	}
	ctx = withOutgoingAuth(ctx)
	return s.client.GetTask(ctx, &taskpb.GetTaskRequest{Id: id})
}

func (s *taskService) List(ctx context.Context, req *taskpb.ListTasksRequest) (*taskpb.ListTasksResponse, error) {
	if s.client == nil {
		return nil, errors.New("task service client not configured")
	}
	ctx = withOutgoingAuth(ctx)
	return s.client.ListTasks(ctx, req)
}

func (s *taskService) Update(ctx context.Context, req *taskpb.UpdateTaskRequest) (*taskpb.Task, error) {
	if s.client == nil {
		return nil, errors.New("task service client not configured")
	}
	ctx = withOutgoingAuth(ctx)
	return s.client.UpdateTask(ctx, req)
}

func (s *taskService) Delete(ctx context.Context, id string) error {
	if s.client == nil {
		return errors.New("task service client not configured")
	}
	ctx = withOutgoingAuth(ctx)
	_, err := s.client.DeleteTask(ctx, &taskpb.DeleteTaskRequest{Id: id})
	return err
}

func (s *taskService) BuildView(ctx context.Context, tasks []*taskpb.Task) ([]gin.H, error) {
	if len(tasks) == 0 {
		return []gin.H{}, nil
	}
	if s.userService == nil || s.orgService == nil {
		return nil, errors.New("task service dependencies not configured")
	}

	userIDs := make(map[string]struct{})
	orgIDs := make(map[string]struct{})
	for _, t := range tasks {
		if id := t.GetAssigneeId(); id != "" {
			userIDs[id] = struct{}{}
		}
		if id := t.GetReporterId(); id != "" {
			userIDs[id] = struct{}{}
		}
		if id := t.GetOrganizationId(); id != "" {
			orgIDs[id] = struct{}{}
		}
	}

	users, err := s.userService.ListByIDs(ctx, collections.MapKeys(userIDs))
	if err != nil {
		return nil, err
	}

	userMap := make(map[string]*userpb.User, len(users))
	for _, u := range users {
		userMap[u.GetId()] = u
	}

	for id := range userIDs {
		if id == "" {
			continue
		}
		if _, ok := userMap[id]; ok {
			continue
		}
		user, fetchErr := s.userService.Get(ctx, id)
		if fetchErr != nil {
			if st, ok := status.FromError(fetchErr); ok && st.Code() == codes.NotFound {
				continue
			}
			return nil, fetchErr
		}
		userMap[id] = user
	}

	orgList, err := s.orgService.ListByIDs(ctx, collections.MapKeys(orgIDs))
	if err != nil {
		return nil, err
	}
	orgMap := make(map[string]*organizationpb.Organization, len(orgList))
	for _, org := range orgList {
		if org == nil || org.GetId() == "" {
			continue
		}
		orgMap[org.GetId()] = org
	}
	for id := range orgIDs {
		if id == "" {
			continue
		}
		if _, ok := orgMap[id]; ok {
			continue
		}
		org, fetchErr := s.orgService.Get(ctx, id)
		if fetchErr != nil {
			if st, ok := status.FromError(fetchErr); ok && st.Code() == codes.NotFound {
				continue
			}
			return nil, fetchErr
		}
		orgMap[id] = org
	}

	items := make([]gin.H, 0, len(tasks))
	for _, t := range tasks {
		opts := tasktransform.DetailOptions{
			Organization:   orgMap[t.GetOrganizationId()],
			OrganizationID: t.GetOrganizationId(),
			Assignee:       userMap[t.GetAssigneeId()],
			AssigneeID:     t.GetAssigneeId(),
			Reporter:       userMap[t.GetReporterId()],
			ReporterID:     t.GetReporterId(),
		}
		items = append(items, tasktransform.ToDetailedMap(t, opts))
	}

	return items, nil
}
