package routes

import (
	"github.com/aliirah/task-flow/services/api-gateway/handlers"
	"github.com/gin-gonic/gin"
)

type Dependencies struct {
	Health *handlers.HealthHandler
	Auth   *handlers.AuthHandler
	User   *handlers.UserHandler
}

func Register(router *gin.Engine, deps Dependencies) {
	api := router.Group("/api")

	registerHealthRoutes(api, deps.Health)
	registerAuthRoutes(api, deps.Auth)
	registerUserRoutes(api, deps.User)
}
