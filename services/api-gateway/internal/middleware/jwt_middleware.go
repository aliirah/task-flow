package middleware

import (
	"net/http"
	"strings"

	"github.com/aliirah/task-flow/shared/rest"
	"github.com/gin-gonic/gin"
)

func JWTAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if !strings.HasPrefix(authHeader, "Bearer ") || len(authHeader) <= len("Bearer ") {
			rest.Error(c, http.StatusUnauthorized, "missing or invalid authorization token",
				rest.WithErrorCode("auth.invalid_token"))
			c.Abort()
			return
		}

		// TODO: parse and validate the JWT token here.

		c.Next()
	}
}
