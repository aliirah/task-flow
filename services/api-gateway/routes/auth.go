package routes

import (
	"github.com/aliirah/task-flow/services/api-gateway/handlers"
	"github.com/aliirah/task-flow/services/api-gateway/middleware"
	"github.com/gin-gonic/gin"
)

func registerAuthRoutes(api *gin.RouterGroup, handler *handlers.AuthHandler) {
	auth := api.Group("/auth")
	auth.POST("/login", handler.Login)
	auth.POST("/refresh", handler.Refresh)

	protected := auth.Group("/")
	protected.Use(middleware.JWTAuth())
	protected.POST("/logout", handler.Logout)
}
