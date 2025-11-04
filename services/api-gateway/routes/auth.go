package routes

import (
	httphandler "github.com/aliirah/task-flow/services/api-gateway/internal/handler/http"
	"github.com/aliirah/task-flow/services/api-gateway/internal/middleware"
	"github.com/gin-gonic/gin"
)

func registerAuthRoutes(api *gin.RouterGroup, handler *httphandler.AuthHandler) {
	auth := api.Group("/auth")
	auth.POST("/signup", handler.SignUp)
	auth.POST("/login", handler.Login)
	auth.POST("/refresh", handler.Refresh)

	protected := auth.Group("/")
	protected.Use(middleware.JWTAuth())
	protected.POST("/logout", handler.Logout)
}
