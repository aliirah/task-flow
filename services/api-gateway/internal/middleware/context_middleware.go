package middleware

import (
	"github.com/aliirah/task-flow/shared/logging"
	"github.com/aliirah/task-flow/shared/rest"
	requestid "github.com/gin-contrib/requestid"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// RequestContext enriches the request with identifiers and logging metadata. It
// relies on gin-contrib/requestid to populate the base request ID.
func RequestContext() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := requestid.Get(c)
		if requestID == "" {
			requestID = uuid.NewString()
		}

		c.Set(rest.ContextKeyRequestID, requestID)

		ctx := logging.ContextWithFields(
			c.Request.Context(),
			zap.String("request_id", requestID),
			zap.String("method", c.Request.Method),
			zap.String("path", c.Request.URL.Path),
		)
		c.Request = c.Request.WithContext(ctx)

		c.Next()
	}
}
