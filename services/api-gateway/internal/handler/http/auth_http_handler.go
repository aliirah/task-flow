package http

import (
	"errors"
	"net/http"
	"time"

	"github.com/aliirah/task-flow/services/api-gateway/internal/dto"
	"github.com/aliirah/task-flow/services/api-gateway/internal/service"
	"github.com/aliirah/task-flow/shared/rest"
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
	var payload dto.SignUpPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		rest.Error(c, http.StatusBadRequest, "invalid request payload",
			rest.WithErrorCode("validation.invalid_payload"))
		return
	}
	if err := h.validator.Struct(payload); err != nil {
		rest.Error(c, http.StatusBadRequest, "validation failed",
			rest.WithErrorCode("validation.failed"),
			rest.WithErrorDetails(util.CollectValidationErrors(err)))
		return
	}

	req := payload.Build()
	resp, err := h.service.SignUp(c.Request.Context(), &req)
	if rest.HandleGRPCError(c, err, rest.WithNamespace("auth")) {
		return
	}

	respondWithTokens(c, resp, http.StatusCreated)
}

func (h *AuthHandler) Login(c *gin.Context) {
	var payload dto.LoginPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		rest.Error(c, http.StatusBadRequest, "invalid request payload",
			rest.WithErrorCode("validation.invalid_payload"))
		return
	}
	if err := h.validator.Struct(payload); err != nil {
		rest.Error(c, http.StatusBadRequest, "validation failed",
			rest.WithErrorCode("validation.failed"),
			rest.WithErrorDetails(util.CollectValidationErrors(err)))
		return
	}

	req := payload.Build()
	tokens, err := h.service.Login(c.Request.Context(), &req)
	if rest.HandleGRPCError(c, err, rest.WithNamespace("auth")) {
		return
	}

	respondWithTokens(c, tokens, http.StatusOK)
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	var payload dto.RefreshPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		rest.Error(c, http.StatusBadRequest, "invalid request payload",
			rest.WithErrorCode("validation.invalid_payload"))
		return
	}
	if err := h.validator.Struct(payload); err != nil {
		rest.Error(c, http.StatusBadRequest, "validation failed",
			rest.WithErrorCode("validation.failed"),
			rest.WithErrorDetails(util.CollectValidationErrors(err)))
		return
	}

	refreshReq := payload.Build()

	tokens, err := h.service.Refresh(c.Request.Context(), &refreshReq)
	if rest.HandleGRPCError(c, err, rest.WithNamespace("auth")) {
		return
	}

	respondWithTokens(c, tokens, http.StatusOK)
}

func (h *AuthHandler) Logout(c *gin.Context) {
	var payload dto.LogoutPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		rest.Error(c, http.StatusBadRequest, "invalid request payload",
			rest.WithErrorCode("validation.invalid_payload"))
		return
	}

	if err := h.validator.Struct(payload); err != nil {
		rest.Error(c, http.StatusBadRequest, "validation failed",
			rest.WithErrorCode("validation.failed"),
			rest.WithErrorDetails(util.CollectValidationErrors(err)))
		return
	}

	logoutReq := payload.Build()

	if rest.HandleGRPCError(c, h.service.Logout(c.Request.Context(), &logoutReq), rest.WithNamespace("auth")) {
		return
	}

	rest.NoContent(c)
}

func respondWithTokens(c *gin.Context, resp *service.AuthTokenResponse, status int) {
	if resp == nil {
		rest.InternalError(c, errors.New("auth service returned empty response"))
		return
	}

	payload := gin.H{
		"accessToken":  resp.GetAccessToken(),
		"refreshToken": resp.GetRefreshToken(),
	}

	if resp.GetExpiresAt() != nil {
		payload["expiresAt"] = resp.GetExpiresAt().AsTime().UTC().Format(time.RFC3339)
	}

	if resp.GetUser() != nil {
		payload["user"] = gin.H{
			"id":        resp.GetUser().GetId(),
			"email":     resp.GetUser().GetEmail(),
			"firstName": resp.GetUser().GetFirstName(),
			"lastName":  resp.GetUser().GetLastName(),
			"roles":     resp.GetUser().GetRoles(),
			"status":    resp.GetUser().GetStatus(),
			"userType":  resp.GetUser().GetUserType(),
		}
	}

	if status == http.StatusCreated {
		rest.Created(c, payload)
	} else {
		rest.Ok(c, payload)
	}
}
