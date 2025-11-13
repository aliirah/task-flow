package routes

import (
	httphandler "github.com/aliirah/task-flow/services/api-gateway/internal/handler/http"
	"github.com/gin-gonic/gin"
)

func registerOrganizationRoutes(api *gin.RouterGroup, handler *httphandler.OrganizationHandler, authMiddleware gin.HandlerFunc, orgMiddlewareGen func(string) gin.HandlerFunc) {
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

	// Organization-specific routes with membership validation
	if orgMiddlewareGen != nil {
		orgs.GET("/:id", orgMiddlewareGen("id"), handler.Get)
		orgs.PATCH("/:id", orgMiddlewareGen("id"), handler.Update)
		orgs.PUT("/:id", orgMiddlewareGen("id"), handler.Update)
		orgs.DELETE("/:id", orgMiddlewareGen("id"), handler.Delete)

		orgs.POST("/:id/members", orgMiddlewareGen("id"), handler.AddMember)
		orgs.GET("/:id/members", orgMiddlewareGen("id"), handler.ListMembers)
		orgs.DELETE("/:id/members/:userId", orgMiddlewareGen("id"), handler.RemoveMember)
	} else {
		orgs.GET("/:id", handler.Get)
		orgs.PATCH("/:id", handler.Update)
		orgs.PUT("/:id", handler.Update)
		orgs.DELETE("/:id", handler.Delete)

		orgs.POST("/:id/members", handler.AddMember)
		orgs.GET("/:id/members", handler.ListMembers)
		orgs.DELETE("/:id/members/:userId", handler.RemoveMember)
	}
}
