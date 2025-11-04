package service

import (
	"context"
	"errors"

	taskpb "github.com/aliirah/task-flow/shared/proto/task/v1"
)

// TaskService exposes task RPCs behind a gateway-friendly interface.
type TaskService interface {
	Create(ctx context.Context, req *taskpb.CreateTaskRequest) (*taskpb.Task, error)
	Get(ctx context.Context, id string) (*taskpb.Task, error)
	List(ctx context.Context, req *taskpb.ListTasksRequest) (*taskpb.ListTasksResponse, error)
	Update(ctx context.Context, req *taskpb.UpdateTaskRequest) (*taskpb.Task, error)
	Delete(ctx context.Context, id string) error
}

type taskService struct {
	client taskpb.TaskServiceClient
}

// NewTaskService constructs a TaskService backed by the given gRPC client.
func NewTaskService(client taskpb.TaskServiceClient) TaskService {
	return &taskService{client: client}
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
