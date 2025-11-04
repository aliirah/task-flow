package http

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/aliirah/task-flow/services/api-gateway/internal/service"
	"github.com/aliirah/task-flow/shared/rest"
	"github.com/aliirah/task-flow/shared/util"
	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
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
		UserType  string `json:"userType" validate:"omitempty,oneof=user admin"`
	}

	var payload signUpPayload
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

	userType := strings.TrimSpace(payload.UserType)
	if userType == "" {
		userType = "user"
	}

	resp, err := h.service.SignUp(c.Request.Context(), &service.AuthSignUpRequest{
		Email:     payload.Email,
		Password:  payload.Password,
		FirstName: payload.FirstName,
		LastName:  payload.LastName,
		UserType:  userType,
	})
	if err != nil {
		writeAuthServiceError(c, err)
		return
	}

	respondWithTokens(c, resp, http.StatusCreated)
}

func (h *AuthHandler) Login(c *gin.Context) {
	type loginPayload struct {
		Identifier string `json:"identifier" validate:"required"`
		Password   string `json:"password" validate:"required,min=8"`
	}

	var payload loginPayload
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

	req := service.AuthLoginRequest{Identifier: payload.Identifier, Password: payload.Password}
	tokens, err := h.service.Login(c.Request.Context(), &req)
	if err != nil {
		writeAuthServiceError(c, err)
		return
	}

	respondWithTokens(c, tokens, http.StatusOK)
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	type refreshPayload struct {
		RefreshToken string `json:"refreshToken" validate:"required"`
	}

	var payload refreshPayload
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

	refreshReq := service.AuthRefreshRequest{RefreshToken: payload.RefreshToken}

	tokens, err := h.service.Refresh(c.Request.Context(), &refreshReq)
	if err != nil {
		writeAuthServiceError(c, err)
		return
	}

	respondWithTokens(c, tokens, http.StatusOK)
}

func (h *AuthHandler) Logout(c *gin.Context) {
	type logoutPayload struct {
		RefreshToken string `json:"refreshToken" validate:"required"`
	}

	var payload logoutPayload
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

	logoutReq := service.AuthLogoutRequest{RefreshToken: payload.RefreshToken}

	if err := h.service.Logout(c.Request.Context(), &logoutReq); err != nil {
		writeAuthServiceError(c, err)
		return
	}

	rest.NoContent(c)
}

func writeAuthServiceError(c *gin.Context, err error) {
	if err == nil {
		return
	}

	if st, ok := status.FromError(err); ok {
		switch st.Code() {
		case codes.InvalidArgument, codes.FailedPrecondition:
			rest.Error(c, http.StatusBadRequest, st.Message(),
				rest.WithErrorCode("auth.invalid_request"))
		case codes.AlreadyExists:
			rest.Error(c, http.StatusConflict, st.Message(),
				rest.WithErrorCode("auth.already_exists"))
		case codes.Unauthenticated, codes.PermissionDenied:
			rest.Error(c, http.StatusUnauthorized, st.Message(),
				rest.WithErrorCode("auth.invalid_credentials"))
		case codes.NotFound:
			rest.Error(c, http.StatusNotFound, st.Message(),
				rest.WithErrorCode("auth.not_found"))
		default:
			rest.Error(c, http.StatusBadGateway, "auth service error",
				rest.WithErrorCode("auth.service_error"),
				rest.WithErrorDetails(st.Message()))
		}
		return
	}

	rest.Error(c, http.StatusBadGateway, "auth service unavailable",
		rest.WithErrorCode("auth.unavailable"),
		rest.WithErrorDetails(err.Error()))
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
