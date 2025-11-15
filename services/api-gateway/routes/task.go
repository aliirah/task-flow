package routes

import (
	httphandler "github.com/aliirah/task-flow/services/api-gateway/internal/handler/http"
	"github.com/gin-gonic/gin"
)

func registerTaskRoutes(api *gin.RouterGroup, handler *httphandler.TaskHandler, authMiddleware gin.HandlerFunc, orgMiddlewareGen func(string) gin.HandlerFunc) {
	if handler == nil {
		return
	}

	group := api.Group("/tasks")
	if authMiddleware != nil {
		group.Use(authMiddleware)
	}

	// Create and list don't need per-task org validation
	// Create: org validation via organizationId in body
	if orgMiddlewareGen != nil {
		group.POST("", orgMiddlewareGen(""), handler.Create)
	} else {
		group.POST("", handler.Create)
	}
	
	group.GET("", handler.List)
	group.POST("/reorder", handler.Reorder)
	
	// Task-specific operations - org membership validated at backend
	group.GET("/:id", handler.Get)
	group.PATCH("/:id", handler.Update)
	group.PUT("/:id", handler.Update)
	group.DELETE("/:id", handler.Delete)

	// Comment routes - org membership validated at backend (task's org)
	group.POST("/:id/comments", handler.CreateComment)
	group.GET("/:id/comments", handler.ListComments)

	// Comment operations by comment ID - org membership validated at backend
	comments := api.Group("/comments")
	if authMiddleware != nil {
		comments.Use(authMiddleware)
	}
	comments.GET("/:id", handler.GetComment)
	comments.PATCH("/:id", handler.UpdateComment)
	comments.PUT("/:id", handler.UpdateComment)
	comments.DELETE("/:id", handler.DeleteComment)
}
