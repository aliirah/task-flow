package http

import (
	"context"
	"net/http"
	"strconv"

	"github.com/aliirah/task-flow/services/api-gateway/internal/dto"
	"github.com/aliirah/task-flow/services/api-gateway/internal/service"
	"github.com/aliirah/task-flow/shared/authctx"
	taskdomain "github.com/aliirah/task-flow/shared/domain/task"
	organizationpb "github.com/aliirah/task-flow/shared/proto/organization/v1"
	taskpb "github.com/aliirah/task-flow/shared/proto/task/v1"
	userpb "github.com/aliirah/task-flow/shared/proto/user/v1"
	"github.com/aliirah/task-flow/shared/rest"
	tasktransform "github.com/aliirah/task-flow/shared/transform/task"
	"github.com/aliirah/task-flow/shared/util"
	"github.com/aliirah/task-flow/shared/util/collections"
	"github.com/aliirah/task-flow/shared/util/stringset"
	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
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

// Create handles POST /api/tasks.
func (h *TaskHandler) Create(c *gin.Context) {
	var payload dto.CreateTaskPayload
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

	currentUser, _ := authctx.UserFromGin(c)

	req, err := payload.Build(currentUser.ID)
	if err != nil {
		rest.Error(c, http.StatusBadRequest, err.Error(),
			rest.WithErrorCode("task.invalid_request"))
		return
	}

	task, err := h.taskService.Create(c.Request.Context(), req)
	if rest.HandleGRPCError(c, err, rest.WithNamespace("task")) {
		return
	}

	items, err := h.enrichTasks(c.Request.Context(), []*taskpb.Task{task})
	if err != nil {
		if rest.HandleGRPCError(c, err, rest.WithNamespace("task")) {
			return
		}
		rest.InternalError(c, err)
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

	status, err := stringset.Normalize(c.Query("status"), "status", taskdomain.StatusSet, "")
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
	if rest.HandleGRPCError(c, err, rest.WithNamespace("task")) {
		return
	}

	items, err := h.enrichTasks(c.Request.Context(), resp.GetItems())
	if err != nil {
		if rest.HandleGRPCError(c, err, rest.WithNamespace("task")) {
			return
		}
		rest.InternalError(c, err)
		return
	}

	rest.Ok(c, gin.H{"items": items})
}

// Get handles GET /api/tasks/:id.
func (h *TaskHandler) Get(c *gin.Context) {
	task, err := h.taskService.Get(c.Request.Context(), c.Param("id"))
	if rest.HandleGRPCError(c, err, rest.WithNamespace("task")) {
		return
	}
	items, err := h.enrichTasks(c.Request.Context(), []*taskpb.Task{task})
	if err != nil {
		if rest.HandleGRPCError(c, err, rest.WithNamespace("task")) {
			return
		}
		rest.InternalError(c, err)
		return
	}
	if len(items) == 0 {
		rest.Ok(c, gin.H{})
		return
	}
	rest.Ok(c, items[0])
}

// Update handles PATCH /api/tasks/:id.
func (h *TaskHandler) Update(c *gin.Context) {
	var payload dto.UpdateTaskPayload
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

	req, err := payload.Build(c.Param("id"))
	if err != nil {
		rest.Error(c, http.StatusBadRequest, err.Error(),
			rest.WithErrorCode("task.invalid_request"))
		return
	}

	task, err := h.taskService.Update(c.Request.Context(), req)
	if rest.HandleGRPCError(c, err, rest.WithNamespace("task")) {
		return
	}

	items, err := h.enrichTasks(c.Request.Context(), []*taskpb.Task{task})
	if err != nil {
		if rest.HandleGRPCError(c, err, rest.WithNamespace("task")) {
			return
		}
		rest.InternalError(c, err)
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
	if rest.HandleGRPCError(c, h.taskService.Delete(c.Request.Context(), c.Param("id")), rest.WithNamespace("task")) {
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
		opts := tasktransform.DetailOptions{
			Organization:   orgMap[task.GetOrganizationId()],
			OrganizationID: task.GetOrganizationId(),
			Assignee:       userMap[task.GetAssigneeId()],
			AssigneeID:     task.GetAssigneeId(),
			Reporter:       userMap[task.GetReporterId()],
			ReporterID:     task.GetReporterId(),
		}
		items = append(items, tasktransform.ToDetailedMap(task, opts))
	}

	return items, nil
}
