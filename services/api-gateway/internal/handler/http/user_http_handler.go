package http

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/aliirah/task-flow/services/api-gateway/internal/service"
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
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"items": users})
}

func (h *UserHandler) Get(c *gin.Context) {
	id := c.Param("id")
	user, err := h.service.Get(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, user)
}

func (h *UserHandler) Create(c *gin.Context) {
	type userCreatePayload struct {
		Email     string   `json:"email" validate:"required,email"`
		Password  string   `json:"password" validate:"required,min=8"`
		FirstName string   `json:"firstName" validate:"required,min=2"`
		LastName  string   `json:"lastName" validate:"required,min=2"`
		UserType  string   `json:"userType" validate:"required,oneof=user admin"`
		Roles     []string `json:"roles" validate:"omitempty,dive,required"`
	}

	var payload userCreatePayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request payload"})
		return
	}
	if err := h.validator.Struct(payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "validation failed",
			"details": util.CollectValidationErrors(err),
		})
		return
	}

	createReq := &service.UserCreateInput{
		Email:     strings.TrimSpace(payload.Email),
		Password:  payload.Password,
		FirstName: strings.TrimSpace(payload.FirstName),
		LastName:  strings.TrimSpace(payload.LastName),
		UserType:  payload.UserType,
		Roles:     payload.Roles,
	}

	created, err := h.service.Create(c.Request.Context(), createReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, created)
}

func (h *UserHandler) Update(c *gin.Context) {
	id := c.Param("id")
	type userUpdatePayload struct {
		FirstName *string   `json:"firstName" validate:"omitempty,min=2"`
		LastName  *string   `json:"lastName" validate:"omitempty,min=2"`
		Roles     *[]string `json:"roles" validate:"omitempty,dive,required"`
		Status    *string   `json:"status" validate:"omitempty,oneof=active inactive suspended"`
		UserType  *string   `json:"userType" validate:"omitempty,oneof=user admin"`
	}

	var payload userUpdatePayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request payload"})
		return
	}
	if err := h.validator.Struct(payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "validation failed",
			"details": util.CollectValidationErrors(err),
		})
		return
	}

	updateReq := &service.UserUpdateInput{
		FirstName: trimPointer(payload.FirstName),
		LastName:  trimPointer(payload.LastName),
		Roles:     payload.Roles,
		Status:    trimPointer(payload.Status),
		UserType:  trimPointer(payload.UserType),
	}

	updated, err := h.service.Update(c.Request.Context(), id, updateReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updated)
}

func (h *UserHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	if err := h.service.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

func (h *UserHandler) UpdateProfile(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing user identity"})
		return
	}

	type profilePayload struct {
		FirstName *string `json:"firstName" validate:"omitempty,min=2"`
		LastName  *string `json:"lastName" validate:"omitempty,min=2"`
	}

	var payload profilePayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request payload"})
		return
	}
	if err := h.validator.Struct(payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "validation failed",
			"details": util.CollectValidationErrors(err),
		})
		return
	}

	profileReq := &service.ProfileUpdateInput{
		FirstName: trimPointer(payload.FirstName),
		LastName:  trimPointer(payload.LastName),
	}

	updated, err := h.service.UpdateProfile(c.Request.Context(), userID, profileReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updated)
}

func trimPointer(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}
