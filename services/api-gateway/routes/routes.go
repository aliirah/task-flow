package routes

import (
	httphandler "github.com/aliirah/task-flow/services/api-gateway/internal/handler/http"
	"github.com/gin-gonic/gin"
)

type Dependencies struct {
	Health         *httphandler.HealthHandler
	Auth           *httphandler.AuthHandler
	User           *httphandler.UserHandler
	Organization   *httphandler.OrganizationHandler
	Task           *httphandler.TaskHandler
	AuthMiddleware gin.HandlerFunc
}

func Register(router *gin.Engine, deps Dependencies) {
	api := router.Group("/api")

	registerHealthRoutes(api, deps.Health)
	registerAuthRoutes(api, deps.Auth, deps.AuthMiddleware)
	registerUserRoutes(api, deps.User, deps.AuthMiddleware)
	registerOrganizationRoutes(api, deps.Organization, deps.AuthMiddleware)
	registerTaskRoutes(api, deps.Task, deps.AuthMiddleware)
}
