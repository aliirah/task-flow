package routes

import (
	httphandler "github.com/aliirah/task-flow/services/api-gateway/internal/handler/http"
	wshandler "github.com/aliirah/task-flow/services/api-gateway/internal/handler/ws"
	"github.com/gin-gonic/gin"
)

type Dependencies struct {
	Health                    *httphandler.HealthHandler
	Auth                      *httphandler.AuthHandler
	User                      *httphandler.UserHandler
	Organization              *httphandler.OrganizationHandler
	Task                      *httphandler.TaskHandler
	Notification              *httphandler.NotificationHandler
	Search                    *httphandler.SearchHandler
	WS                        *wshandler.Handler
	AuthMiddleware            gin.HandlerFunc
	OrganizationMiddlewareGen func(paramName string) gin.HandlerFunc
}

func Register(router *gin.Engine, deps Dependencies) {
	api := router.Group("/api")

	registerHealthRoutes(api, deps.Health)
	registerAuthRoutes(api, deps.Auth, deps.AuthMiddleware)
	registerUserRoutes(api, deps.User, deps.AuthMiddleware)
	registerOrganizationRoutes(api, deps.Organization, deps.AuthMiddleware, deps.OrganizationMiddlewareGen)
	registerTaskRoutes(api, deps.Task, deps.AuthMiddleware, deps.OrganizationMiddlewareGen)
	registerNotificationRoutes(api, deps.Notification, deps.AuthMiddleware)
	registerSearchRoutes(api, deps.Search, deps.AuthMiddleware)
	registerWSRoutes(api, deps.WS)
}
