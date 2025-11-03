package routes

import (
	"net/http"

	"github.com/aliirah/task-flow/services/api-gateway/handlers"
	"github.com/aliirah/task-flow/services/api-gateway/middleware"
	"github.com/aliirah/task-flow/services/api-gateway/services"
	"github.com/gin-gonic/gin"
)

func Register(router *gin.Engine) {
	healthService := services.NewHealthService()
	healthHandler := handlers.NewHealthHandler(healthService)

	api := router.Group("/api")
	api.GET("/health", healthHandler.Health)

	protected := api.Group("/")
	protected.Use(middleware.JWTAuth())
	protected.GET("/sample", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "secured route",
		})
	})
}
