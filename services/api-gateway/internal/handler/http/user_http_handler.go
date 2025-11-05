package http

import (
	"net/http"
	"strconv"

	"github.com/aliirah/task-flow/services/api-gateway/internal/dto"
	"github.com/aliirah/task-flow/services/api-gateway/internal/service"
	"github.com/aliirah/task-flow/shared/authctx"
	"github.com/aliirah/task-flow/shared/rest"
	"github.com/aliirah/task-flow/shared/util"
	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
)

type UserHandler struct {
	service   service.UserService
	validator *validator.Validate
}

func NewUserHandler(svc service.UserService) *UserHandler {
	return &UserHandler{service: svc, validator: util.NewValidator()}
}

func (h *UserHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	filter := service.UserFilter{
		Query: c.Query("q"),
		Role:  c.Query("role"),
		Page:  page,
		Limit: limit,
	}

	users, err := h.service.List(c.Request.Context(), filter)
	if rest.HandleGRPCError(c, err, rest.WithNamespace("user")) {
		return
	}

	rest.Ok(c, map[string]any{"items": users})
}

func (h *UserHandler) Get(c *gin.Context) {
	id := c.Param("id")
	user, err := h.service.Get(c.Request.Context(), id)
	if rest.HandleGRPCError(c, err, rest.WithNamespace("user")) {
		return
	}

	rest.Ok(c, user)
}

func (h *UserHandler) Create(c *gin.Context) {
	var payload dto.UserCreatePayload
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

	createReq := payload.Build()

	created, err := h.service.Create(c.Request.Context(), createReq)
	if rest.HandleGRPCError(c, err, rest.WithNamespace("user")) {
		return
	}

	rest.Created(c, created)
}

func (h *UserHandler) Update(c *gin.Context) {
	id := c.Param("id")
	var payload dto.UserUpdatePayload
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

	updateReq := payload.Build()

	updated, err := h.service.Update(c.Request.Context(), id, updateReq)
	if rest.HandleGRPCError(c, err, rest.WithNamespace("user")) {
		return
	}

	rest.Ok(c, updated)
}

func (h *UserHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	if rest.HandleGRPCError(c, h.service.Delete(c.Request.Context(), id), rest.WithNamespace("user")) {
		return
	}

	rest.NoContent(c)
}

func (h *UserHandler) UpdateProfile(c *gin.Context) {
	user, ok := authctx.UserFromGin(c)
	if !ok || user.ID == "" {
		rest.Error(c, http.StatusUnauthorized, "missing user identity",
			rest.WithErrorCode("auth.missing_identity"))
		return
	}

	var payload dto.ProfilePayload
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

	profileReq := payload.Build()

	updated, err := h.service.UpdateProfile(c.Request.Context(), user.ID, profileReq)
	if rest.HandleGRPCError(c, err, rest.WithNamespace("user")) {
		return
	}

	rest.Ok(c, updated)
}
