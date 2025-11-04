package authctx

import (
	"context"

	"github.com/gin-gonic/gin"
)

const ginContextKey = "authctx.user"

// AttachToGin stores the user on both gin and request contexts.
func AttachToGin(c *gin.Context, user User) {
	ctx := WithUser(c.Request.Context(), user)
	c.Request = c.Request.WithContext(ctx)
	c.Set(ginContextKey, user)
}

// UserFromGin extracts the user from gin context, falling back to request context.
func UserFromGin(c *gin.Context) (User, bool) {
	if v, ok := c.Get(ginContextKey); ok {
		if user, ok := v.(User); ok {
			return user, true
		}
	}
	return UserFromContext(c.Request.Context())
}

// ContextWithUser returns a context enriched with the user details.
func ContextWithUser(ctx context.Context, user User) context.Context {
	return WithUser(ctx, user)
}
