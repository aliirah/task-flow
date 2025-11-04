package middleware

import (
	"net/http"
	"strings"

	"github.com/aliirah/task-flow/services/api-gateway/internal/service"
	"github.com/aliirah/task-flow/shared/authctx"
	"github.com/aliirah/task-flow/shared/logging"
	"github.com/aliirah/task-flow/shared/rest"
	"github.com/gin-gonic/gin"
)

// JWTAuth validates bearer tokens via the auth service and attaches user
// identity details to the request context.
func JWTAuth(authSvc service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if !strings.HasPrefix(authHeader, "Bearer ") {
			rest.Error(c, http.StatusUnauthorized, "missing or invalid authorization token",
				rest.WithErrorCode("auth.invalid_token"))
			c.Abort()
			return
		}

		token := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer"))
		if token == "" {
			rest.Error(c, http.StatusUnauthorized, "missing or invalid authorization token",
				rest.WithErrorCode("auth.invalid_token"))
			c.Abort()
			return
		}

		resp, err := authSvc.Validate(c.Request.Context(), &service.AuthValidateRequest{
			AccessToken: token,
		})
		if err != nil {
			rest.Error(c, http.StatusUnauthorized, "invalid or expired token",
				rest.WithErrorCode("auth.invalid_token"),
				rest.WithErrorDetails(err.Error()))
			c.Abort()
			return
		}

		user := authctx.User{
			ID:        resp.GetUser().GetId(),
			Email:     resp.GetUser().GetEmail(),
			FirstName: resp.GetUser().GetFirstName(),
			LastName:  resp.GetUser().GetLastName(),
			Roles:     resp.GetUser().GetRoles(),
			Status:    resp.GetUser().GetStatus(),
			UserType:  resp.GetUser().GetUserType(),
		}

		ctx := logging.ContextWithFields(c.Request.Context(), user.Fields()...)
		c.Request = c.Request.WithContext(ctx)
		authctx.AttachToGin(c, user)

		c.Next()
	}
}
