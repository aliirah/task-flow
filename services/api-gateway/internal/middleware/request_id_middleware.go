package middleware

import (
	"github.com/aliirah/task-flow/shared/rest"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// RequestID ensures every incoming request has a request identifier available.
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader(rest.HeaderRequestID)
		if requestID == "" {
			requestID = uuid.NewString()
		}

		c.Set(rest.ContextKeyRequestID, requestID)
		c.Writer.Header().Set(rest.HeaderRequestID, requestID)

		c.Next()
	}
}
