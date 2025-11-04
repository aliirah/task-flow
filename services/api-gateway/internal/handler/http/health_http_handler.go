package http

import (
	"net/http"

	"github.com/aliirah/task-flow/services/api-gateway/internal/service"
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
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, result)
}
