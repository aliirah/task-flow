package routes

import (
	"github.com/aliirah/task-flow/services/api-gateway/handlers"
	"github.com/gin-gonic/gin"
)

func registerHealthRoutes(api *gin.RouterGroup, handler *handlers.HealthHandler) {
	api.GET("/health", handler.Health)
}
