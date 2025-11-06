package metrics

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// GinMiddleware returns a Gin middleware for collecting HTTP metrics
func GinMiddleware(serviceName string) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		// Process request
		c.Next()

		// Record metrics after request is processed
		duration := time.Since(start)
		status := c.Writer.Status()

		statusStr := strconv.Itoa(status)

		// Record request duration
		HTTPRequestDuration.WithLabelValues(
			serviceName+c.Request.URL.Path,
			c.Request.Method,
			statusStr,
		).Observe(duration.Seconds())

		// Increment request counter
		HTTPRequestTotal.WithLabelValues(
			serviceName+c.Request.URL.Path,
			c.Request.Method,
			statusStr,
		).Inc()
	}
}
