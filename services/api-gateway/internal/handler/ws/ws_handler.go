package ws

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	gatewayservice "github.com/aliirah/task-flow/services/api-gateway/internal/service"
	log "github.com/aliirah/task-flow/shared/logging"
	"github.com/aliirah/task-flow/shared/messaging"
	"github.com/aliirah/task-flow/shared/rest"
)

type Handler struct {
	authService gatewayservice.AuthService
	orgService  gatewayservice.OrganizationService
	connMgr     *messaging.ConnectionManager
}

type ackMessage struct {
	Type string `json:"type"`
	Data any    `json:"data,omitempty"`
}

func NewHandler(authSvc gatewayservice.AuthService, orgSvc gatewayservice.OrganizationService, connMgr *messaging.ConnectionManager) *Handler {
	return &Handler{authService: authSvc, orgService: orgSvc, connMgr: connMgr}
}

func (h *Handler) Handle(c *gin.Context) {
	token := h.authService.ExtractToken(c)
	if token == "" {
		rest.Error(c, http.StatusUnauthorized, "missing access token", rest.WithErrorCode("auth.token_required"))
		return
	}

	validateResp, err := h.authService.Validate(c.Request.Context(), &gatewayservice.AuthValidateRequest{AccessToken: token})
	if err != nil {
		rest.HandleGRPCError(c, err, rest.WithNamespace("auth"))
		return
	}
	user := validateResp.GetUser()
	if user == nil {
		rest.Error(c, http.StatusUnauthorized, "invalid access token", rest.WithErrorCode("auth.unauthenticated"))
		return
	}

	conn, err := h.connMgr.Upgrade(c.Writer, c.Request)
	if err != nil {
		rest.InternalError(c, err)
		return
	}

	h.orgService.ConfigureConnection(conn)

	connID := h.connMgr.Add(user.GetId(), conn)

	allowed, err := h.orgService.SubscribeMemberships(c.Request.Context(), user.GetId(), connID, h.connMgr)
	if err != nil {
		log.Warn("list user memberships for websocket", zap.Error(err), zap.String("userId", user.GetId()))
	}

	if writeErr := conn.WriteJSON(ackMessage{Type: "connection.established"}); writeErr != nil {
		log.Warn("write websocket ack", zap.Error(writeErr), zap.String("userId", user.GetId()))
		h.connMgr.Remove(connID)
		_ = conn.Close()
		return
	}

	h.orgService.HandleSubscriptionMessages(conn, h.connMgr, connID, user.GetId(), allowed)
}
