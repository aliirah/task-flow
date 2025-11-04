package middleware

import (
	"net/http"

	"github.com/aliirah/task-flow/shared/rest"
	"github.com/gin-gonic/gin"
)

// ErrorHandler ensures unhandled errors are returned in the standard response envelope.
func ErrorHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		if len(c.Errors) == 0 || c.Writer.Written() {
			return
		}

		rest.Error(c, http.StatusInternalServerError, "internal server error", rest.WithErrorDetails(c.Errors.Last().Error()))
	}
}
