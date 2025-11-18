package http

import (
	"net/http"
	"strconv"

	"github.com/aliirah/task-flow/services/api-gateway/internal/service"
	"github.com/aliirah/task-flow/shared/authctx"
	"github.com/aliirah/task-flow/shared/rest"
	"github.com/aliirah/task-flow/shared/transform/notification"
	"github.com/gin-gonic/gin"
)

type NotificationHandler struct {
	service service.NotificationService
}

func NewNotificationHandler(svc service.NotificationService) *NotificationHandler {
	return &NotificationHandler{service: svc}
}

func (h *NotificationHandler) List(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		return
	}

	page := clampPositive(c.DefaultQuery("page", "1"), 1)
	limit := clampPositive(c.DefaultQuery("limit", "20"), 20)
	isReadParam := c.Query("is_read")

	var isRead *bool
	if isReadParam != "" {
		val := isReadParam == "true"
		isRead = &val
	}

	filter := service.NotificationFilter{
		UserID: userID,
		IsRead: isRead,
		Page:   page,
		Limit:  limit,
	}

	notifications, err := h.service.List(c.Request.Context(), filter)
	if rest.HandleGRPCError(c, err, rest.WithNamespace("notification")) {
		return
	}

	// Transform to HTTP response format with proper camelCase
	httpNotifications := notification.ToHTTPList(notifications)
	rest.Ok(c, map[string]any{"items": httpNotifications})
}

func (h *NotificationHandler) GetUnreadCount(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		return
	}

	count, err := h.service.GetUnreadCount(c.Request.Context(), userID)
	if rest.HandleGRPCError(c, err, rest.WithNamespace("notification")) {
		return
	}

	rest.Ok(c, map[string]any{"count": count})
}

func (h *NotificationHandler) MarkAsRead(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		return
	}

	id := c.Param("id")
	if id == "" {
		rest.Error(c, http.StatusBadRequest, "notification id is required",
			rest.WithErrorCode("notification.id_required"))
		return
	}

	err := h.service.MarkAsRead(c.Request.Context(), userID, id)
	if rest.HandleGRPCError(c, err, rest.WithNamespace("notification")) {
		return
	}

	rest.Ok(c, gin.H{"message": "notification marked as read"})
}

func (h *NotificationHandler) MarkAllAsRead(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		return
	}

	err := h.service.MarkAllAsRead(c.Request.Context(), userID)
	if rest.HandleGRPCError(c, err, rest.WithNamespace("notification")) {
		return
	}

	rest.Ok(c, gin.H{"message": "all notifications marked as read"})
}

func (h *NotificationHandler) Delete(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		return
	}

	id := c.Param("id")
	if id == "" {
		rest.Error(c, http.StatusBadRequest, "notification id is required",
			rest.WithErrorCode("notification.id_required"))
		return
	}

	err := h.service.Delete(c.Request.Context(), userID, id)
	if rest.HandleGRPCError(c, err, rest.WithNamespace("notification")) {
		return
	}

	rest.Ok(c, gin.H{"message": "notification deleted"})
}

func getUserID(c *gin.Context) (string, bool) {
	user, ok := authctx.UserFromGin(c)
	if !ok || user.ID == "" {
		rest.Error(c, http.StatusUnauthorized, "unauthorized",
			rest.WithErrorCode("auth.unauthorized"))
		return "", false
	}
	return user.ID, true
}

func clampPositive(raw string, fallback int) int {
	value, err := strconv.Atoi(raw)
	if err != nil || value <= 0 {
		return fallback
	}
	return value
}
