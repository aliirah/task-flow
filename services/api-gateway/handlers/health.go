package handlers

import (
	"net/http"

	"github.com/aliirah/task-flow/services/api-gateway/services"
	"github.com/gin-gonic/gin"
)

type HealthHandler struct {
	service services.HealthService
}

func NewHealthHandler(service services.HealthService) *HealthHandler {
	return &HealthHandler{service: service}
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
