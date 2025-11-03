package handlers

import (
	"net/http"
	"strings"

	"github.com/aliirah/task-flow/services/api-gateway/services"
	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	service services.AuthService
}

func NewAuthHandler(service services.AuthService) *AuthHandler {
	return &AuthHandler{service: service}
}

func (h *AuthHandler) Login(c *gin.Context) {
	var payload services.AuthLoginRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tokens, err := h.service.Login(c.Request.Context(), &payload)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, tokens)
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	var payload struct {
		RefreshToken string `json:"refreshToken" binding:"required"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	refreshReq := services.AuthRefreshRequest{RefreshToken: payload.RefreshToken}

	tokens, err := h.service.Refresh(c.Request.Context(), &refreshReq)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, tokens)
}

func (h *AuthHandler) Logout(c *gin.Context) {
	rawAuth := c.GetHeader("Authorization")
	token := strings.TrimSpace(strings.TrimPrefix(rawAuth, "Bearer"))
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing authorization token"})
		return
	}

	logoutReq := services.AuthLogoutRequest{AccessToken: token}

	if err := h.service.Logout(c.Request.Context(), &logoutReq); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}
