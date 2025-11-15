package http

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"go.uber.org/zap"

	"github.com/aliirah/task-flow/services/api-gateway/internal/dto"
	"github.com/aliirah/task-flow/services/api-gateway/internal/service"
	"github.com/aliirah/task-flow/shared/authctx"
	taskdomain "github.com/aliirah/task-flow/shared/domain/task"
	"github.com/aliirah/task-flow/shared/logging"
	taskpb "github.com/aliirah/task-flow/shared/proto/task/v1"
	"github.com/aliirah/task-flow/shared/rest"
	tasktransform "github.com/aliirah/task-flow/shared/transform/task"
	"github.com/aliirah/task-flow/shared/util"
	"github.com/aliirah/task-flow/shared/util/stringset"
)

// TaskHandler serves task endpoints for the API Gateway.
type TaskHandler struct {
	taskService service.TaskService
	validator   *validator.Validate
}

// NewTaskHandler constructs a new TaskHandler.
func NewTaskHandler(taskSvc service.TaskService) *TaskHandler {
	return &TaskHandler{
		taskService: taskSvc,
		validator:   util.NewValidator(),
	}
}

// Create handles POST /api/tasks.
func (h *TaskHandler) Create(c *gin.Context) {
	var payload dto.CreateTaskPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		logging.FromContext(c.Request.Context()).Warn("failed to bind JSON payload", zap.Error(err))
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

	items, err := h.taskService.BuildView(c.Request.Context(), []*taskpb.Task{task})
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
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 10
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
		Limit:          int32(limit + 1),
		SortBy:         c.Query("sortBy"),
		SortOrder:      c.Query("sortOrder"),
		Search:         c.Query("search"),
	}

	resp, err := h.taskService.List(c.Request.Context(), req)
	if rest.HandleGRPCError(c, err, rest.WithNamespace("task")) {
		return
	}

	protoItems := resp.GetItems()
	hasMore := len(protoItems) > limit
	if hasMore {
		protoItems = protoItems[:limit]
	}

	items, err := h.taskService.BuildView(c.Request.Context(), protoItems)
	if err != nil {
		if rest.HandleGRPCError(c, err, rest.WithNamespace("task")) {
			return
		}
		rest.InternalError(c, err)
		return
	}

	rest.Ok(c, gin.H{
		"items":   items,
		"page":    page,
		"limit":   limit,
		"hasMore": hasMore,
	})
}

// Get handles GET /api/tasks/:id.
func (h *TaskHandler) Get(c *gin.Context) {
	task, err := h.taskService.Get(c.Request.Context(), c.Param("id"))
	if rest.HandleGRPCError(c, err, rest.WithNamespace("task")) {
		return
	}
	items, err := h.taskService.BuildView(c.Request.Context(), []*taskpb.Task{task})
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

	items, err := h.taskService.BuildView(c.Request.Context(), []*taskpb.Task{task})
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

// Reorder handles POST /api/tasks/reorder.
func (h *TaskHandler) Reorder(c *gin.Context) {
	var payload dto.ReorderTasksPayload
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

	req, err := payload.Build()
	if err != nil {
		rest.Error(c, http.StatusBadRequest, err.Error(),
			rest.WithErrorCode("validation.invalid_payload"))
		return
	}

	if rest.HandleGRPCError(c, h.taskService.Reorder(c.Request.Context(), req), rest.WithNamespace("task")) {
		return
	}
	rest.NoContent(c)
}

// CreateComment handles POST /api/tasks/:id/comments.
func (h *TaskHandler) CreateComment(c *gin.Context) {
	var payload dto.CreateCommentPayload
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

	req := payload.Build(c.Param("id"))
	comment, err := h.taskService.CreateComment(c.Request.Context(), req)
	if rest.HandleGRPCError(c, err, rest.WithNamespace("comment")) {
		return
	}

	rest.Created(c, tasktransform.CommentToMap(comment))
}

// ListComments handles GET /api/tasks/:id/comments.
func (h *TaskHandler) ListComments(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	includeReplies := c.Query("includeReplies") == "true"

	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}

	req := &taskpb.ListCommentsRequest{
		TaskId:         c.Param("id"),
		Page:           int32(page),
		Limit:          int32(limit),
		IncludeReplies: includeReplies,
	}

	resp, err := h.taskService.ListComments(c.Request.Context(), req)
	if rest.HandleGRPCError(c, err, rest.WithNamespace("comment")) {
		return
	}

	items := make([]gin.H, 0, len(resp.GetItems()))
	for _, comment := range resp.GetItems() {
		items = append(items, tasktransform.CommentToMap(comment))
	}

	rest.Ok(c, gin.H{
		"items":   items,
		"page":    page,
		"limit":   limit,
		"hasMore": resp.GetHasMore(),
	})
}

// GetComment handles GET /api/comments/:id.
func (h *TaskHandler) GetComment(c *gin.Context) {
	comment, err := h.taskService.GetComment(c.Request.Context(), c.Param("id"))
	if rest.HandleGRPCError(c, err, rest.WithNamespace("comment")) {
		return
	}
	rest.Ok(c, tasktransform.CommentToMap(comment))
}

// UpdateComment handles PATCH /api/comments/:id.
func (h *TaskHandler) UpdateComment(c *gin.Context) {
	var payload dto.UpdateCommentPayload
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

	req := payload.Build(c.Param("id"))
	comment, err := h.taskService.UpdateComment(c.Request.Context(), req)
	if rest.HandleGRPCError(c, err, rest.WithNamespace("comment")) {
		return
	}

	rest.Ok(c, tasktransform.CommentToMap(comment))
}

// DeleteComment handles DELETE /api/comments/:id.
func (h *TaskHandler) DeleteComment(c *gin.Context) {
	if rest.HandleGRPCError(c, h.taskService.DeleteComment(c.Request.Context(), c.Param("id")), rest.WithNamespace("comment")) {
		return
	}
	rest.NoContent(c)
}
