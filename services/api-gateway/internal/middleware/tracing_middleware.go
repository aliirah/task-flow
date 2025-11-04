package middleware

import (
	"github.com/aliirah/task-flow/shared/tracing"
	"github.com/gin-gonic/gin"
)

func HTTPTracing() gin.HandlerFunc {
	return tracing.GinMiddleware()
}
