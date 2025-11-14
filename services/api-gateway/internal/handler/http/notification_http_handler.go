package http

import (
	"net/http"
	"strconv"

	"github.com/aliirah/task-flow/services/api-gateway/internal/service"
	"github.com/aliirah/task-flow/shared/authctx"
	"github.com/aliirah/task-flow/shared/rest"
	"github.com/gin-gonic/gin"
)

type NotificationHandler struct {
	service service.NotificationService
}

func NewNotificationHandler(svc service.NotificationService) *NotificationHandler {
	return &NotificationHandler{service: svc}
}

func (h *NotificationHandler) List(c *gin.Context) {
	user, _ := authctx.UserFromGin(c)
	if user.ID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	isReadParam := c.Query("is_read")
	
	var isRead *bool
	if isReadParam != "" {
		val := isReadParam == "true"
		isRead = &val
	}

	filter := service.NotificationFilter{
		UserID: user.ID,
		IsRead: isRead,
		Page:   page,
		Limit:  limit,
	}

	notifications, err := h.service.List(c.Request.Context(), filter)
	if rest.HandleGRPCError(c, err, rest.WithNamespace("notification")) {
		return
	}

	rest.Ok(c, map[string]any{"items": notifications})
}

func (h *NotificationHandler) GetUnreadCount(c *gin.Context) {
	user, _ := authctx.UserFromGin(c)
	if user.ID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	count, err := h.service.GetUnreadCount(c.Request.Context(), user.ID)
	if rest.HandleGRPCError(c, err, rest.WithNamespace("notification")) {
		return
	}

	rest.Ok(c, map[string]any{"count": count})
}

func (h *NotificationHandler) MarkAsRead(c *gin.Context) {
	user, _ := authctx.UserFromGin(c)
	if user.ID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "notification id is required"})
		return
	}

	err := h.service.MarkAsRead(c.Request.Context(), user.ID, id)
	if rest.HandleGRPCError(c, err, rest.WithNamespace("notification")) {
		return
	}

	rest.Ok(c, gin.H{"message": "notification marked as read"})
}

func (h *NotificationHandler) MarkAllAsRead(c *gin.Context) {
	user, _ := authctx.UserFromGin(c)
	if user.ID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	err := h.service.MarkAllAsRead(c.Request.Context(), user.ID)
	if rest.HandleGRPCError(c, err, rest.WithNamespace("notification")) {
		return
	}

	rest.Ok(c, gin.H{"message": "all notifications marked as read"})
}

func (h *NotificationHandler) Delete(c *gin.Context) {
	user, _ := authctx.UserFromGin(c)
	if user.ID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "notification id is required"})
		return
	}

	err := h.service.Delete(c.Request.Context(), user.ID, id)
	if rest.HandleGRPCError(c, err, rest.WithNamespace("notification")) {
		return
	}

	rest.Ok(c, gin.H{"message": "notification deleted"})
}
