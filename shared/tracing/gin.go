package tracing

import (
	"strings"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/codes"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
	"go.opentelemetry.io/otel/trace"
)

func GinMiddleware() gin.HandlerFunc {
	tracer := otel.Tracer("http-server")

	return func(c *gin.Context) {
		route := c.FullPath()
		if route == "" {
			route = c.Request.URL.Path
		}

		spanName := strings.TrimSpace(c.Request.Method + " " + route)
		if spanName == "" {
			spanName = "http.request"
		}

		ctx, span := tracer.Start(c.Request.Context(), spanName, trace.WithSpanKind(trace.SpanKindServer))
		defer span.End()

		c.Request = c.Request.WithContext(ctx)

		span.SetAttributes(
			semconv.HTTPRequestMethodKey.String(c.Request.Method),
			semconv.HTTPRouteKey.String(route),
			semconv.URLPathKey.String(c.Request.URL.Path),
			semconv.URLFullKey.String(c.Request.URL.String()),
		)

		c.Next()

		span.SetAttributes(semconv.HTTPResponseStatusCodeKey.Int(c.Writer.Status()))

		if len(c.Errors) > 0 {
			span.SetStatus(codes.Error, c.Errors.String())
			for _, ginErr := range c.Errors {
				span.RecordError(ginErr)
			}
		} else {
			span.SetStatus(codes.Ok, "")
		}
	}
}
