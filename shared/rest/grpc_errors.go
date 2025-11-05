package rest

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// GRPCErrorOptions configures how gRPC errors are translated into HTTP responses.
type GRPCErrorOptions struct {
	Namespace       string
	FallbackMessage string
}

// GRPCErrorOption is a functional option for configuring HandleGRPCError.
type GRPCErrorOption func(*GRPCErrorOptions)

// WithNamespace sets the namespace used when generating error codes, e.g. "task".
func WithNamespace(namespace string) GRPCErrorOption {
	return func(opts *GRPCErrorOptions) {
		opts.Namespace = namespace
	}
}

// WithFallbackMessage overrides the default message returned when the downstream
// service is unavailable.
func WithFallbackMessage(message string) GRPCErrorOption {
	return func(opts *GRPCErrorOptions) {
		opts.FallbackMessage = message
	}
}

// HandleGRPCError maps common gRPC status codes to structured REST error responses.
// It returns true when the error was handled and a response has been written.
func HandleGRPCError(c *gin.Context, err error, opts ...GRPCErrorOption) bool {
	if err == nil {
		return false
	}

	cfg := &GRPCErrorOptions{
		Namespace:       "service",
		FallbackMessage: "service unavailable",
	}
	for _, opt := range opts {
		opt(cfg)
	}
	if cfg.Namespace == "" {
		cfg.Namespace = "service"
	}
	if cfg.FallbackMessage == "" {
		cfg.FallbackMessage = fmt.Sprintf("%s unavailable", cfg.Namespace)
	}

	if st, ok := status.FromError(err); ok {
		switch st.Code() {
		case codes.InvalidArgument, codes.FailedPrecondition, codes.OutOfRange:
			Error(c, http.StatusBadRequest, st.Message(),
				WithErrorCode(fmt.Sprintf("%s.invalid_request", cfg.Namespace)))
		case codes.NotFound:
			Error(c, http.StatusNotFound, st.Message(),
				WithErrorCode(fmt.Sprintf("%s.not_found", cfg.Namespace)))
		case codes.PermissionDenied:
			Error(c, http.StatusForbidden, st.Message(),
				WithErrorCode(fmt.Sprintf("%s.forbidden", cfg.Namespace)))
		case codes.Unauthenticated:
			Error(c, http.StatusUnauthorized, st.Message(),
				WithErrorCode(fmt.Sprintf("%s.unauthenticated", cfg.Namespace)))
		case codes.AlreadyExists, codes.Aborted:
			Error(c, http.StatusConflict, st.Message(),
				WithErrorCode(fmt.Sprintf("%s.already_exists", cfg.Namespace)))
		case codes.ResourceExhausted:
			Error(c, http.StatusTooManyRequests, st.Message(),
				WithErrorCode(fmt.Sprintf("%s.rate_limited", cfg.Namespace)))
		case codes.Unimplemented:
			Error(c, http.StatusNotImplemented, st.Message(),
				WithErrorCode(fmt.Sprintf("%s.not_implemented", cfg.Namespace)))
		case codes.Unavailable, codes.DeadlineExceeded:
			Error(c, http.StatusBadGateway, st.Message(),
				WithErrorCode(fmt.Sprintf("%s.unavailable", cfg.Namespace)))
		default:
			Error(c, http.StatusBadGateway, "downstream service error",
				WithErrorCode(fmt.Sprintf("%s.service_error", cfg.Namespace)),
				WithErrorDetails(st.Message()))
		}
		return true
	}

	Error(c, http.StatusBadGateway, cfg.FallbackMessage,
		WithErrorCode(fmt.Sprintf("%s.unavailable", cfg.Namespace)),
		WithErrorDetails(err.Error()))
	return true
}
