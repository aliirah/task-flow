package routes

import (
	httphandler "github.com/aliirah/task-flow/services/api-gateway/internal/handler/http"
	"github.com/gin-gonic/gin"
)

type Dependencies struct {
	Health *httphandler.HealthHandler
	Auth   *httphandler.AuthHandler
	User   *httphandler.UserHandler
}

func Register(router *gin.Engine, deps Dependencies) {
	api := router.Group("/api")

	registerHealthRoutes(api, deps.Health)
	registerAuthRoutes(api, deps.Auth)
	registerUserRoutes(api, deps.User)
}
