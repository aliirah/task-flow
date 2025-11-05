package routes

import (
	wshandler "github.com/aliirah/task-flow/services/api-gateway/internal/handler/ws"
	"github.com/gin-gonic/gin"
)

func registerWSRoutes(api *gin.RouterGroup, handler *wshandler.Handler) {
	if handler == nil {
		return
	}

	api.GET("/ws", handler.Handle)
}
