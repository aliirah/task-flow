package metrics

import (
	"context"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/status"
)

// UnaryServerInterceptor returns a new unary server interceptor for metrics collection
func UnaryServerInterceptor() grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
		start := time.Now()
		resp, err := handler(ctx, req)
		duration := time.Since(start)

		// Extract status code
		code := "ok"
		if err != nil {
			if s, ok := status.FromError(err); ok {
				code = s.Code().String()
			} else {
				code = "unknown_error"
			}
		}

		// Record metrics
		GRPCRequestDuration.WithLabelValues(info.FullMethod, code).Observe(duration.Seconds())
		GRPCRequestTotal.WithLabelValues(info.FullMethod, code).Inc()

		return resp, err
	}
}
