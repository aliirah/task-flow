package routes

import (
	httphandler "github.com/aliirah/task-flow/services/api-gateway/internal/handler/http"
	"github.com/gin-gonic/gin"
)

func registerSearchRoutes(rg *gin.RouterGroup, handler *httphandler.SearchHandler, auth gin.HandlerFunc) {
	if handler == nil {
		return
	}

	group := rg.Group("/search")
	group.Use(auth)
	{
		group.GET("", handler.Search)
		group.GET("/suggest", handler.Suggest)
	}
}
