package routes

import (
	httphandler "github.com/aliirah/task-flow/services/api-gateway/internal/handler/http"
	"github.com/gin-gonic/gin"
)

func registerHealthRoutes(api *gin.RouterGroup, handler *httphandler.HealthHandler) {
	api.GET("/health", handler.Health)
}
