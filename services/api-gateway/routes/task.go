package routes

import (
	httphandler "github.com/aliirah/task-flow/services/api-gateway/internal/handler/http"
	"github.com/gin-gonic/gin"
)

func registerTaskRoutes(api *gin.RouterGroup, handler *httphandler.TaskHandler, authMiddleware gin.HandlerFunc) {
	if handler == nil {
		return
	}

	group := api.Group("/tasks")
	if authMiddleware != nil {
		group.Use(authMiddleware)
	}

	group.POST("", handler.Create)
	group.GET("", handler.List)
	group.GET("/:id", handler.Get)
	group.PATCH("/:id", handler.Update)
	group.DELETE("/:id", handler.Delete)
}
