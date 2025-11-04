package routes

import (
	httphandler "github.com/aliirah/task-flow/services/api-gateway/internal/handler/http"
	"github.com/aliirah/task-flow/services/api-gateway/internal/middleware"
	"github.com/gin-gonic/gin"
)

func registerUserRoutes(api *gin.RouterGroup, handler *httphandler.UserHandler) {
	users := api.Group("/users")
	users.Use(middleware.JWTAuth())
	users.GET("", handler.List)
	users.POST("", handler.Create)
	users.GET("/:id", handler.Get)
	users.PATCH("/:id", handler.Update)
	users.DELETE("/:id", handler.Delete)

	profile := api.Group("/profile")
	profile.Use(middleware.JWTAuth())
	profile.PUT("", handler.UpdateProfile)
}
