package http

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/aliirah/task-flow/services/api-gateway/internal/service"
	"github.com/aliirah/task-flow/shared/authctx"
	organizationpb "github.com/aliirah/task-flow/shared/proto/organization/v1"
	taskpb "github.com/aliirah/task-flow/shared/proto/task/v1"
	userpb "github.com/aliirah/task-flow/shared/proto/user/v1"
	"github.com/aliirah/task-flow/shared/rest"
	orgtransform "github.com/aliirah/task-flow/shared/transform/organization"
	tasktransform "github.com/aliirah/task-flow/shared/transform/task"
	usertransform "github.com/aliirah/task-flow/shared/transform/user"
	"github.com/aliirah/task-flow/shared/util"
	"github.com/aliirah/task-flow/shared/util/collections"
	"github.com/aliirah/task-flow/shared/util/stringset"
	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	timestamppb "google.golang.org/protobuf/types/known/timestamppb"
	wrapperspb "google.golang.org/protobuf/types/known/wrapperspb"
)

var (
	taskStatuses   = map[string]struct{}{"open": {}, "in_progress": {}, "completed": {}, "blocked": {}, "cancelled": {}}
	taskPriorities = map[string]struct{}{"low": {}, "medium": {}, "high": {}, "critical": {}}
)

// TaskHandler serves task endpoints for the API Gateway.
type TaskHandler struct {
	taskService service.TaskService
	userService service.UserService
	orgService  service.OrganizationService
	validator   *validator.Validate
}

// NewTaskHandler constructs a new TaskHandler.
func NewTaskHandler(taskSvc service.TaskService, userSvc service.UserService, orgSvc service.OrganizationService) *TaskHandler {
	return &TaskHandler{
		taskService: taskSvc,
		userService: userSvc,
		orgService:  orgSvc,
		validator:   util.NewValidator(),
	}
}

type createTaskPayload struct {
	Title          string  `json:"title" validate:"required,min=3"`
	Description    string  `json:"description" validate:"omitempty,max=4096"`
	Status         string  `json:"status" validate:"omitempty"`
	Priority       string  `json:"priority" validate:"omitempty"`
	OrganizationID string  `json:"organizationId" validate:"required,uuid4"`
	AssigneeID     string  `json:"assigneeId" validate:"omitempty,uuid4"`
	ReporterID     string  `json:"reporterId" validate:"omitempty,uuid4"`
	DueAt          *string `json:"dueAt" validate:"omitempty"`
}

// Create handles POST /api/tasks.
func (h *TaskHandler) Create(c *gin.Context) {
	var payload createTaskPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		rest.Error(c, http.StatusBadRequest, "invalid request payload",
			rest.WithErrorCode("validation.invalid_payload"))
		return
	}
	if err := h.validator.Struct(payload); err != nil {
		rest.Error(c, http.StatusBadRequest, "validation failed",
			rest.WithErrorCode("validation.failed"),
			rest.WithErrorDetails(util.CollectValidationErrors(err)))
		return
	}

	status, err := stringset.Normalize(payload.Status, "status", taskStatuses, "open")
	if err != nil {
		rest.Error(c, http.StatusBadRequest, err.Error(),
			rest.WithErrorCode("validation.invalid_status"))
		return
	}
	priority, err := stringset.Normalize(payload.Priority, "priority", taskPriorities, "medium")
	if err != nil {
		rest.Error(c, http.StatusBadRequest, err.Error(),
			rest.WithErrorCode("validation.invalid_priority"))
		return
	}

	var dueAt *time.Time
	if payload.DueAt != nil && strings.TrimSpace(*payload.DueAt) != "" {
		parsed, parseErr := time.Parse(time.RFC3339, strings.TrimSpace(*payload.DueAt))
		if parseErr != nil {
			rest.Error(c, http.StatusBadRequest, "invalid dueAt format, expected RFC3339",
				rest.WithErrorCode("validation.invalid_due_at"))
			return
		}
		dueAt = &parsed
	}

	currentUser, _ := authctx.UserFromGin(c)
	if payload.ReporterID == "" && currentUser.ID != "" {
		payload.ReporterID = currentUser.ID
	}

	req := &taskpb.CreateTaskRequest{
		Title:          strings.TrimSpace(payload.Title),
		Description:    strings.TrimSpace(payload.Description),
		Status:         status,
		Priority:       priority,
		OrganizationId: payload.OrganizationID,
		AssigneeId:     payload.AssigneeID,
		ReporterId:     payload.ReporterID,
	}
	if dueAt != nil {
		due := dueAt.UTC()
		req.DueAt = timestamppb.New(due)
	}

	task, err := h.taskService.Create(c.Request.Context(), req)
	if err != nil {
		writeTaskError(c, err)
		return
	}

	items, err := h.enrichTasks(c.Request.Context(), []*taskpb.Task{task})
	if err != nil {
		writeTaskError(c, err)
		return
	}
	if len(items) == 0 {
		rest.Created(c, gin.H{})
		return
	}
	rest.Created(c, items[0])
}

// List handles GET /api/tasks.
func (h *TaskHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}

	status, err := stringset.Normalize(c.Query("status"), "status", taskStatuses, "")
	if err != nil {
		rest.Error(c, http.StatusBadRequest, err.Error(),
			rest.WithErrorCode("validation.invalid_status"))
		return
	}

	req := &taskpb.ListTasksRequest{
		OrganizationId: c.Query("organizationId"),
		AssigneeId:     c.Query("assigneeId"),
		ReporterId:     c.Query("reporterId"),
		Status:         status,
		Page:           int32(page),
		Limit:          int32(limit),
	}

	resp, err := h.taskService.List(c.Request.Context(), req)
	if err != nil {
		writeTaskError(c, err)
		return
	}

	items, err := h.enrichTasks(c.Request.Context(), resp.GetItems())
	if err != nil {
		writeTaskError(c, err)
		return
	}

	rest.Ok(c, gin.H{"items": items})
}

// Get handles GET /api/tasks/:id.
func (h *TaskHandler) Get(c *gin.Context) {
	task, err := h.taskService.Get(c.Request.Context(), c.Param("id"))
	if err != nil {
		writeTaskError(c, err)
		return
	}
	items, err := h.enrichTasks(c.Request.Context(), []*taskpb.Task{task})
	if err != nil {
		writeTaskError(c, err)
		return
	}
	if len(items) == 0 {
		rest.Ok(c, gin.H{})
		return
	}
	rest.Ok(c, items[0])
}

type updateTaskPayload struct {
	Title          *string `json:"title" validate:"omitempty,min=3"`
	Description    *string `json:"description" validate:"omitempty,max=4096"`
	Status         *string `json:"status" validate:"omitempty"`
	Priority       *string `json:"priority" validate:"omitempty"`
	OrganizationID *string `json:"organizationId" validate:"omitempty,uuid4"`
	AssigneeID     *string `json:"assigneeId" validate:"omitempty,uuid4"`
	ReporterID     *string `json:"reporterId" validate:"omitempty,uuid4"`
	DueAt          *string `json:"dueAt" validate:"omitempty"`
}

// Update handles PATCH /api/tasks/:id.
func (h *TaskHandler) Update(c *gin.Context) {
	var payload updateTaskPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		rest.Error(c, http.StatusBadRequest, "invalid request payload",
			rest.WithErrorCode("validation.invalid_payload"))
		return
	}
	if err := h.validator.Struct(payload); err != nil {
		rest.Error(c, http.StatusBadRequest, "validation failed",
			rest.WithErrorCode("validation.failed"),
			rest.WithErrorDetails(util.CollectValidationErrors(err)))
		return
	}

	if payload.Status != nil {
		if _, err := stringset.Normalize(*payload.Status, "status", taskStatuses, ""); err != nil {
			rest.Error(c, http.StatusBadRequest, err.Error(),
				rest.WithErrorCode("validation.invalid_status"))
			return
		}
	}
	if payload.Priority != nil {
		if _, err := stringset.Normalize(*payload.Priority, "priority", taskPriorities, ""); err != nil {
			rest.Error(c, http.StatusBadRequest, err.Error(),
				rest.WithErrorCode("validation.invalid_priority"))
			return
		}
	}

	req := &taskpb.UpdateTaskRequest{Id: c.Param("id")}
	if payload.Title != nil {
		req.Title = wrapperspb.String(strings.TrimSpace(*payload.Title))
	}
	if payload.Description != nil {
		req.Description = wrapperspb.String(strings.TrimSpace(*payload.Description))
	}
	if payload.Status != nil {
		value, _ := stringset.Normalize(*payload.Status, "status", taskStatuses, "")
		if value != "" {
			req.Status = wrapperspb.String(value)
		}
	}
	if payload.Priority != nil {
		value, _ := stringset.Normalize(*payload.Priority, "priority", taskPriorities, "")
		if value != "" {
			req.Priority = wrapperspb.String(value)
		}
	}
	if payload.OrganizationID != nil {
		req.OrganizationId = wrapperspb.String(strings.TrimSpace(*payload.OrganizationID))
	}
	if payload.AssigneeID != nil {
		req.AssigneeId = wrapperspb.String(strings.TrimSpace(*payload.AssigneeID))
	}
	if payload.ReporterID != nil {
		req.ReporterId = wrapperspb.String(strings.TrimSpace(*payload.ReporterID))
	}
	if payload.DueAt != nil && strings.TrimSpace(*payload.DueAt) != "" {
		parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(*payload.DueAt))
		if err != nil {
			rest.Error(c, http.StatusBadRequest, "invalid dueAt format, expected RFC3339",
				rest.WithErrorCode("validation.invalid_due_at"))
			return
		}
		due := parsed.UTC()
		req.DueAt = timestamppb.New(due)
	}

	task, err := h.taskService.Update(c.Request.Context(), req)
	if err != nil {
		writeTaskError(c, err)
		return
	}

	items, err := h.enrichTasks(c.Request.Context(), []*taskpb.Task{task})
	if err != nil {
		writeTaskError(c, err)
		return
	}
	if len(items) == 0 {
		rest.Ok(c, gin.H{})
		return
	}
	rest.Ok(c, items[0])
}

// Delete handles DELETE /api/tasks/:id.
func (h *TaskHandler) Delete(c *gin.Context) {
	if err := h.taskService.Delete(c.Request.Context(), c.Param("id")); err != nil {
		writeTaskError(c, err)
		return
	}
	rest.NoContent(c)
}

func (h *TaskHandler) enrichTasks(ctx context.Context, tasks []*taskpb.Task) ([]gin.H, error) {
	if len(tasks) == 0 {
		return []gin.H{}, nil
	}

	userIDs := make(map[string]struct{})
	orgIDs := make(map[string]struct{})
	for _, task := range tasks {
		if id := task.GetAssigneeId(); id != "" {
			userIDs[id] = struct{}{}
		}
		if id := task.GetReporterId(); id != "" {
			userIDs[id] = struct{}{}
		}
		if id := task.GetOrganizationId(); id != "" {
			orgIDs[id] = struct{}{}
		}
	}

	users, err := h.userService.ListByIDs(ctx, collections.MapKeys(userIDs))
	if err != nil {
		return nil, err
	}
	userMap := make(map[string]*userpb.User, len(users))
	for _, u := range users {
		userMap[u.GetId()] = u
	}

	// Fallback fetch for users not returned by ListByIDs.
	for id := range userIDs {
		if id == "" {
			continue
		}
		if _, ok := userMap[id]; ok {
			continue
		}
		user, fetchErr := h.userService.Get(ctx, id)
		if fetchErr != nil {
			if st, ok := status.FromError(fetchErr); ok && st.Code() == codes.NotFound {
				continue
			}
			return nil, fetchErr
		}
		userMap[id] = user
	}

	orgList, err := h.orgService.ListByIDs(ctx, collections.MapKeys(orgIDs))
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
		org, fetchErr := h.orgService.Get(ctx, id)
		if fetchErr != nil {
			if st, ok := status.FromError(fetchErr); ok && st.Code() == codes.NotFound {
				continue
			}
			return nil, fetchErr
		}
		orgMap[id] = org
	}

	items := make([]gin.H, 0, len(tasks))
	for _, task := range tasks {
		item := tasktransform.ToMap(task)

		if org := orgMap[task.GetOrganizationId()]; org != nil {
			item["organization"] = orgtransform.ToMap(org)
		} else if id := task.GetOrganizationId(); id != "" {
			item["organization"] = gin.H{"id": id}
		}
		if assignee := userMap[task.GetAssigneeId()]; assignee != nil {
			item["assignee"] = usertransform.ToMap(assignee)
		} else if id := task.GetAssigneeId(); id != "" {
			item["assignee"] = gin.H{"id": id}
		}
		if reporter := userMap[task.GetReporterId()]; reporter != nil {
			item["reporter"] = usertransform.ToMap(reporter)
		} else if id := task.GetReporterId(); id != "" {
			item["reporter"] = gin.H{"id": id}
		}
		items = append(items, item)
	}

	return items, nil
}

func writeTaskError(c *gin.Context, err error) {
	if err == nil {
		return
	}

	if st, ok := status.FromError(err); ok {
		switch st.Code() {
		case codes.InvalidArgument, codes.FailedPrecondition:
			rest.Error(c, http.StatusBadRequest, st.Message(),
				rest.WithErrorCode("task.invalid_request"))
		case codes.NotFound:
			rest.Error(c, http.StatusNotFound, st.Message(),
				rest.WithErrorCode("task.not_found"))
		case codes.PermissionDenied:
			rest.Error(c, http.StatusForbidden, st.Message(),
				rest.WithErrorCode("task.forbidden"))
		case codes.Unauthenticated:
			rest.Error(c, http.StatusUnauthorized, st.Message(),
				rest.WithErrorCode("task.unauthenticated"))
		case codes.AlreadyExists:
			rest.Error(c, http.StatusConflict, st.Message(),
				rest.WithErrorCode("task.already_exists"))
		default:
			rest.Error(c, http.StatusBadGateway, "task service error",
				rest.WithErrorCode("task.service_error"),
				rest.WithErrorDetails(st.Message()))
		}
		return
	}

	rest.Error(c, http.StatusBadGateway, "task service unavailable",
		rest.WithErrorCode("task.unavailable"),
		rest.WithErrorDetails(err.Error()))
}
