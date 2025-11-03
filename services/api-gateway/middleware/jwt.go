package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func JWTAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if !strings.HasPrefix(authHeader, "Bearer ") || len(authHeader) <= len("Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "missing or invalid authorization token",
			})
			return
		}

		// TODO: parse and validate the JWT token here.

		c.Next()
	}
}
