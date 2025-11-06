package routes

import (
	httphandler "github.com/aliirah/task-flow/services/api-gateway/internal/handler/http"
	"github.com/gin-gonic/gin"
)

func registerUserRoutes(api *gin.RouterGroup, handler *httphandler.UserHandler, authMiddleware gin.HandlerFunc) {
	users := api.Group("/users")
	if authMiddleware != nil {
		users.Use(authMiddleware)
	}
	users.GET("", handler.List)
	users.POST("", handler.Create)
	users.GET("/:id", handler.Get)
	users.PATCH("/:id", handler.Update)
	users.PUT("/:id", handler.Update)
	users.DELETE("/:id", handler.Delete)

	profile := api.Group("/profile")
	if authMiddleware != nil {
		profile.Use(authMiddleware)
	}
	profile.PUT("", handler.UpdateProfile)
}
