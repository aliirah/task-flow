package middleware

import (
	"net/http"

	"github.com/aliirah/task-flow/shared/logging"
	"github.com/aliirah/task-flow/shared/rest"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// ErrorHandler ensures unhandled errors are returned in the standard response envelope.
func ErrorHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		if len(c.Errors) == 0 || c.Writer.Written() {
			return
		}

		last := c.Errors.Last()
		fields := []zap.Field{
			zap.String("request_id", rest.GetRequestID(c)),
			zap.String("route", c.FullPath()),
			zap.Error(last.Err),
		}
		if req := c.Request; req != nil {
			fields = append(fields,
				zap.String("method", req.Method),
				zap.String("path", req.URL.Path),
			)
		}
		logging.FromContext(c.Request.Context()).Error("unhandled request error", fields...)

		rest.Error(c, http.StatusInternalServerError, "internal server error", rest.WithErrorDetails(c.Errors.Last().Error()))
	}
}
