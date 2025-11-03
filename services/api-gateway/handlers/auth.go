package handlers

import (
	"net/http"
	"strings"

	"github.com/aliirah/task-flow/services/api-gateway/services"
	"github.com/aliirah/task-flow/shared/util"
	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
)

type AuthHandler struct {
	service   services.AuthService
	validator *validator.Validate
}

func NewAuthHandler(service services.AuthService) *AuthHandler {
	return &AuthHandler{service: service, validator: util.NewValidator()}
}

func (h *AuthHandler) Login(c *gin.Context) {
	type loginPayload struct {
		Identifier string `json:"identifier" validate:"required"`
		Password   string `json:"password" validate:"required,min=8"`
	}

	var payload loginPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request payload"})
		return
	}
	if err := h.validator.Struct(payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "validation failed",
			"details": util.CollectValidationErrors(err),
		})
		return
	}

	req := services.AuthLoginRequest{Identifier: payload.Identifier, Password: payload.Password}
	tokens, err := h.service.Login(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, tokens)
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	type refreshPayload struct {
		RefreshToken string `json:"refreshToken" validate:"required"`
	}

	var payload refreshPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request payload"})
		return
	}
	if err := h.validator.Struct(payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "validation failed",
			"details": util.CollectValidationErrors(err),
		})
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
