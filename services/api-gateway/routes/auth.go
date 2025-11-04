package routes

import (
	httphandler "github.com/aliirah/task-flow/services/api-gateway/internal/handler/http"
	"github.com/gin-gonic/gin"
)

func registerAuthRoutes(api *gin.RouterGroup, handler *httphandler.AuthHandler, authMiddleware gin.HandlerFunc) {
	auth := api.Group("/auth")
	auth.POST("/signup", handler.SignUp)
	auth.POST("/login", handler.Login)
	auth.POST("/refresh", handler.Refresh)

	protected := auth.Group("/")
	if authMiddleware != nil {
		protected.Use(authMiddleware)
	}
	protected.POST("/logout", handler.Logout)
}
