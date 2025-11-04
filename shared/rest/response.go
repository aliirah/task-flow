package rest

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

const (
	// ContextKeyRequestID is used to store the request ID in the gin context.
	ContextKeyRequestID = "rest.request_id"
	// ContextKeyBatchID is used to store a batch identifier in the gin context.
	ContextKeyBatchID = "rest.batch_id"
	// HeaderRequestID is the HTTP header used for propagating the request ID.
	HeaderRequestID = "X-Request-ID"

	statusSuccess = "success"
	statusError   = "error"
)

// Response is the canonical envelope for all HTTP responses.
type Response struct {
	RequestID string         `json:"requestId,omitempty"`
	BatchID   string         `json:"batchId,omitempty"`
	Status    string         `json:"status"`
	Data      interface{}    `json:"data,omitempty"`
	Error     *ResponseError `json:"error,omitempty"`
}

// ResponseError represents an error payload within the standard response.
type ResponseError struct {
	Code    string      `json:"code,omitempty"`
	Message string      `json:"message"`
	Details interface{} `json:"details,omitempty"`
}

// ErrorOption customises the error payload produced by Error.
type ErrorOption func(*ResponseError)

// WithErrorCode attaches a machine readable error code to the response.
func WithErrorCode(code string) ErrorOption {
	return func(err *ResponseError) {
		err.Code = code
	}
}

// WithErrorDetails attaches additional error context to the response.
func WithErrorDetails(details interface{}) ErrorOption {
	return func(err *ResponseError) {
		err.Details = details
	}
}

// Ok emits a 200 response using the standard envelope.
func Ok(c *gin.Context, data interface{}) {
	respond(c, http.StatusOK, statusSuccess, data, nil)
}

// Created emits a 201 response using the standard envelope.
func Created(c *gin.Context, data interface{}) {
	respond(c, http.StatusCreated, statusSuccess, data, nil)
}

// NoContent emits an empty successful response using the envelope.
func NoContent(c *gin.Context) {
	respond(c, http.StatusOK, statusSuccess, map[string]any{}, nil)
}

// Error emits a structured error response.
func Error(c *gin.Context, status int, message string, opts ...ErrorOption) {
	payload := &ResponseError{Message: message}
	for _, opt := range opts {
		opt(payload)
	}
	respond(c, status, statusError, nil, payload)
}

// InternalError is a helper for unexpected server errors.
func InternalError(c *gin.Context, err error) {
	if err == nil {
		Error(c, http.StatusInternalServerError, "internal server error")
		return
	}
	Error(c, http.StatusInternalServerError, "internal server error", WithErrorDetails(err.Error()))
}

// Custom emits a response with a caller-provided status string. Useful for
// uncommon outcomes such as "queued" or "partial".
func Custom(c *gin.Context, httpStatus int, status string, data interface{}, err *ResponseError) {
	if status == "" {
		status = statusSuccess
	}
	respond(c, httpStatus, status, data, err)
}

// SetBatchID stores a batch identifier in the context for later inclusion in responses.
func SetBatchID(c *gin.Context, batchID string) {
	if batchID == "" {
		return
	}
	c.Set(ContextKeyBatchID, batchID)
}

// GetRequestID extracts the request ID from context.
func GetRequestID(c *gin.Context) string {
	if v, ok := c.Get(ContextKeyRequestID); ok {
		if id, ok := v.(string); ok {
			return id
		}
	}
	return ""
}

// GetBatchID extracts the batch ID from context.
func GetBatchID(c *gin.Context) string {
	if v, ok := c.Get(ContextKeyBatchID); ok {
		if id, ok := v.(string); ok {
			return id
		}
	}
	return ""
}

func respond(c *gin.Context, httpStatus int, status string, data interface{}, err *ResponseError) {
	resp := Response{
		RequestID: GetRequestID(c),
		BatchID:   GetBatchID(c),
		Status:    status,
		Data:      data,
		Error:     err,
	}

	// Ensure 2xx responses always include a data field.
	if httpStatus >= 200 && httpStatus < 300 && resp.Data == nil {
		resp.Data = map[string]any{}
	}

	c.JSON(httpStatus, resp)
}
