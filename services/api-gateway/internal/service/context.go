package service

import (
	"context"

	"github.com/aliirah/task-flow/shared/authctx"
)

func withOutgoingAuth(ctx context.Context) context.Context {
	if user, ok := authctx.UserFromContext(ctx); ok {
		return authctx.OutgoingContext(ctx, user)
	}
	return ctx
}
