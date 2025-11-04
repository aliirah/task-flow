package routes

import (
	httphandler "github.com/aliirah/task-flow/services/api-gateway/internal/handler/http"
	"github.com/gin-gonic/gin"
)

func registerOrganizationRoutes(api *gin.RouterGroup, handler *httphandler.OrganizationHandler, authMiddleware gin.HandlerFunc) {
	if handler == nil {
		return
	}

	orgs := api.Group("/organizations")
	if authMiddleware != nil {
		orgs.Use(authMiddleware)
	}

	orgs.POST("", handler.Create)
	orgs.GET("", handler.List)
	orgs.GET("/mine", handler.ListUserMemberships)
	orgs.GET("/:id", handler.Get)
	orgs.PATCH("/:id", handler.Update)
	orgs.DELETE("/:id", handler.Delete)

	orgs.POST("/:id/members", handler.AddMember)
	orgs.GET("/:id/members", handler.ListMembers)
	orgs.DELETE("/:id/members/:userId", handler.RemoveMember)
}
