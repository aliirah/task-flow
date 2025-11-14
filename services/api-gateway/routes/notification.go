package routes

import (
	httphandler "github.com/aliirah/task-flow/services/api-gateway/internal/handler/http"
	"github.com/gin-gonic/gin"
)

func registerNotificationRoutes(api *gin.RouterGroup, handler *httphandler.NotificationHandler, authMiddleware gin.HandlerFunc) {
	notifications := api.Group("/notifications", authMiddleware)
	{
		notifications.GET("", handler.List)
		notifications.GET("/unread/count", handler.GetUnreadCount)
		notifications.PATCH("/:id/read", handler.MarkAsRead)
		notifications.POST("/mark-all-read", handler.MarkAllAsRead)
		notifications.DELETE("/:id", handler.Delete)
	}
}
