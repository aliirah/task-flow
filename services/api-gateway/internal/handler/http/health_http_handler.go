package http

import (
	"net/http"

	"github.com/aliirah/task-flow/services/api-gateway/internal/service"
	"github.com/aliirah/task-flow/shared/rest"
	"github.com/gin-gonic/gin"
)

type HealthHandler struct {
	service service.HealthService
}

func NewHealthHandler(svc service.HealthService) *HealthHandler {
	return &HealthHandler{service: svc}
}

func (h *HealthHandler) Health(c *gin.Context) {
	result, err := h.service.Status(c.Request.Context())
	if err != nil {
		rest.Error(c, http.StatusInternalServerError, "health check failed",
			rest.WithErrorCode("health.failed"),
			rest.WithErrorDetails(err.Error()))
		return
	}

	rest.Ok(c, result)
}
