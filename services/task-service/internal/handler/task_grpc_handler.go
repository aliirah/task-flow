package handler

import (
	"context"
	"errors"
	"time"

	"github.com/aliirah/task-flow/services/task-service/internal/models"
	"github.com/aliirah/task-flow/services/task-service/internal/service"
	"github.com/aliirah/task-flow/shared/authctx"
	taskpb "github.com/aliirah/task-flow/shared/proto/task/v1"
	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	emptypb "google.golang.org/protobuf/types/known/emptypb"
	timestamppb "google.golang.org/protobuf/types/known/timestamppb"
	"gorm.io/gorm"
)

type TaskHandler struct {
	taskpb.UnimplementedTaskServiceServer
	svc *service.Service
}

func NewTaskHandler(svc *service.Service) *TaskHandler {
	return &TaskHandler{svc: svc}
}

func (h *TaskHandler) CreateTask(ctx context.Context, req *taskpb.CreateTaskRequest) (*taskpb.Task, error) {
	orgID, err := parseUUID(req.GetOrganizationId())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "invalid organization id")
	}
	assigneeID, err := parseUUID(req.GetAssigneeId())
	if err != nil && req.GetAssigneeId() != "" {
		return nil, status.Error(codes.InvalidArgument, "invalid assignee id")
	}
	reporterID, err := parseUUID(req.GetReporterId())
	if err != nil && req.GetReporterId() != "" {
		return nil, status.Error(codes.InvalidArgument, "invalid reporter id")
	}

	initiator, _ := authctx.IncomingUser(ctx)

	task, err := h.svc.CreateTask(ctx, service.CreateTaskInput{
		Title:          req.GetTitle(),
		Description:    req.GetDescription(),
		Status:         req.GetStatus(),
		Priority:       req.GetPriority(),
		OrganizationID: orgID,
		AssigneeID:     assigneeID,
		ReporterID:     reporterID,
		DueAt:          timestampToTime(req.GetDueAt()),
	}, initiator)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return toProtoTask(task), nil
}

func (h *TaskHandler) GetTask(ctx context.Context, req *taskpb.GetTaskRequest) (*taskpb.Task, error) {
	id, err := parseUUID(req.GetId())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "invalid task id")
	}
	task, err := h.svc.GetTask(ctx, id)
	if err != nil {
		return nil, grpcError(err)
	}
	return toProtoTask(task), nil
}

func (h *TaskHandler) ListTasks(ctx context.Context, req *taskpb.ListTasksRequest) (*taskpb.ListTasksResponse, error) {
	params := service.ListTasksParams{Page: int(req.GetPage()), Limit: int(req.GetLimit()), Status: req.GetStatus()}

	if req.GetOrganizationId() != "" {
		id, err := parseUUID(req.GetOrganizationId())
		if err != nil {
			return nil, status.Error(codes.InvalidArgument, "invalid organization id")
		}
		params.OrganizationID = id
	}
	if req.GetAssigneeId() != "" {
		id, err := parseUUID(req.GetAssigneeId())
		if err != nil {
			return nil, status.Error(codes.InvalidArgument, "invalid assignee id")
		}
		params.AssigneeID = id
	}
	if req.GetReporterId() != "" {
		id, err := parseUUID(req.GetReporterId())
		if err != nil {
			return nil, status.Error(codes.InvalidArgument, "invalid reporter id")
		}
		params.ReporterID = id
	}

	tasks, err := h.svc.ListTasks(ctx, params)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	items := make([]*taskpb.Task, 0, len(tasks))
	for _, t := range tasks {
		task := t
		items = append(items, toProtoTask(&task))
	}

	return &taskpb.ListTasksResponse{Items: items}, nil
}

func (h *TaskHandler) UpdateTask(ctx context.Context, req *taskpb.UpdateTaskRequest) (*taskpb.Task, error) {
	id, err := parseUUID(req.GetId())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "invalid task id")
	}

	input := service.UpdateTaskInput{}
	initiator, _ := authctx.IncomingUser(ctx)
	if req.GetTitle() != nil {
		value := req.GetTitle().GetValue()
		input.Title = &value
	}
	if req.GetDescription() != nil {
		value := req.GetDescription().GetValue()
		input.Description = &value
	}
	if req.GetStatus() != nil {
		value := req.GetStatus().GetValue()
		input.Status = &value
	}
	if req.GetPriority() != nil {
		value := req.GetPriority().GetValue()
		input.Priority = &value
	}
	if req.GetOrganizationId() != nil {
		value, err := parseUUID(req.GetOrganizationId().GetValue())
		if err != nil {
			return nil, status.Error(codes.InvalidArgument, "invalid organization id")
		}
		input.OrganizationID = &value
	}
	if req.GetAssigneeId() != nil {
		value, err := parseUUID(req.GetAssigneeId().GetValue())
		if err != nil {
			return nil, status.Error(codes.InvalidArgument, "invalid assignee id")
		}
		input.AssigneeID = &value
	}
	if req.GetReporterId() != nil {
		value, err := parseUUID(req.GetReporterId().GetValue())
		if err != nil {
			return nil, status.Error(codes.InvalidArgument, "invalid reporter id")
		}
		input.ReporterID = &value
	}
	if req.GetDueAt() != nil {
		due := req.GetDueAt().AsTime()
		input.DueAt = &due
	}

	task, err := h.svc.UpdateTask(ctx, id, input, initiator)
	if err != nil {
		return nil, grpcError(err)
	}

	return toProtoTask(task), nil
}

func (h *TaskHandler) DeleteTask(ctx context.Context, req *taskpb.DeleteTaskRequest) (*emptypb.Empty, error) {
	id, err := parseUUID(req.GetId())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "invalid task id")
	}
	if err := h.svc.DeleteTask(ctx, id); err != nil {
		return nil, grpcError(err)
	}
	return &emptypb.Empty{}, nil
}

func toProtoTask(task *models.Task) *taskpb.Task {
	if task == nil {
		return nil
	}
	var due *timestamppb.Timestamp
	if task.DueAt != nil {
		due = timestamppb.New(*task.DueAt)
	}

	protoTask := &taskpb.Task{
		Id:             task.ID.String(),
		Title:          task.Title,
		Description:    task.Description,
		Status:         task.Status,
		Priority:       task.Priority,
		OrganizationId: task.OrganizationID.String(),
		DueAt:          due,
		CreatedAt:      timestamppb.New(task.CreatedAt),
		UpdatedAt:      timestamppb.New(task.UpdatedAt),
	}

	// Only include IDs if they are not zero UUID
	if task.AssigneeID != uuid.Nil {
		protoTask.AssigneeId = task.AssigneeID.String()
	}
	if task.ReporterID != uuid.Nil {
		protoTask.ReporterId = task.ReporterID.String()
	}

	return protoTask
}

func parseUUID(value string) (uuid.UUID, error) {
	if value == "" {
		return uuid.Nil, nil
	}
	return uuid.Parse(value)
}

func timestampToTime(ts *timestamppb.Timestamp) *time.Time {
	if ts == nil {
		return nil
	}
	t := ts.AsTime()
	return &t
}

func grpcError(err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return status.Error(codes.NotFound, "task not found")
	}
	return status.Error(codes.Internal, err.Error())
}
