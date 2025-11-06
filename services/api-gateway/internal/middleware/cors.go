package middleware

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		allowedOrigins := os.Getenv("CORS_ALLOW_ORIGINS")
		if allowedOrigins == "" {
			allowedOrigins = "http://localhost:3000"
		}

		origin := c.GetHeader("Origin")
		if origin == "" {
			origin = allowedOrigins
		} else {
			origins := strings.Split(allowedOrigins, ",")
			trimmed := strings.TrimSpace(origin)
			allowed := false
			for _, o := range origins {
				if strings.TrimSpace(o) == "*" || strings.TrimSpace(o) == trimmed {
					allowed = true
					break
				}
			}
			if !allowed && strings.Contains(allowedOrigins, "*") {
				allowed = true
			}
			if allowed {
				origin = trimmed
			} else {
				origin = ""
			}
		}

		if origin != "" {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
		}

		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, X-Requested-With, Origin, Accept, Cache-Control")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
