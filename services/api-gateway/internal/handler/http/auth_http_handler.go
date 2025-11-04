package http

import (
	"net/http"
	"strings"

	"github.com/aliirah/task-flow/services/api-gateway/internal/service"
	"github.com/aliirah/task-flow/shared/util"
	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
)

type AuthHandler struct {
	service   service.AuthService
	validator *validator.Validate
}

func NewAuthHandler(svc service.AuthService) *AuthHandler {
	return &AuthHandler{service: svc, validator: util.NewValidator()}
}

func (h *AuthHandler) SignUp(c *gin.Context) {
	type signUpPayload struct {
		Email     string `json:"email" validate:"required,email"`
		Password  string `json:"password" validate:"required,min=8"`
		FirstName string `json:"firstName" validate:"required,min=2"`
		LastName  string `json:"lastName" validate:"required,min=2"`
		UserType  string `json:"userType" validate:"required,oneof=user admin"`
	}

	var payload signUpPayload
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

	resp, err := h.service.SignUp(c.Request.Context(), &service.AuthSignUpRequest{
		Email:     payload.Email,
		Password:  payload.Password,
		FirstName: payload.FirstName,
		LastName:  payload.LastName,
		UserType:  payload.UserType,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, resp)
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

	req := service.AuthLoginRequest{Identifier: payload.Identifier, Password: payload.Password}
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

	refreshReq := service.AuthRefreshRequest{RefreshToken: payload.RefreshToken}

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

	logoutReq := service.AuthLogoutRequest{AccessToken: token}

	if err := h.service.Logout(c.Request.Context(), &logoutReq); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}
