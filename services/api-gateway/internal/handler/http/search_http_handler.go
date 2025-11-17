package http

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/aliirah/task-flow/services/api-gateway/internal/service"
	"github.com/aliirah/task-flow/shared/authctx"
	"github.com/aliirah/task-flow/shared/contracts"
	"github.com/aliirah/task-flow/shared/rest"
)

type SearchHandler struct {
	service *service.SearchService
}

func NewSearchHandler(svc *service.SearchService) *SearchHandler {
	return &SearchHandler{service: svc}
}

func (h *SearchHandler) Search(c *gin.Context) {
	query := strings.TrimSpace(c.Query("q"))
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing query"})
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	types := filterTypes(strings.Split(c.Query("types"), ","))
	organizationID := strings.TrimSpace(c.Query("organizationId"))
	if organizationID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "organizationId is required"})
		return
	}
	userCtx, _ := authctx.UserFromGin(c)
	userID := strings.TrimSpace(c.Query("userId"))
	if userID == "" {
		userID = userCtx.ID
	}

	response, err := h.service.Search(c.Request.Context(), query, types, limit, organizationID, userID)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	rest.Ok(c, response)
}

func (h *SearchHandler) Suggest(c *gin.Context) {
	query := strings.TrimSpace(c.Query("q"))
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing query"})
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "8"))
	organizationID := strings.TrimSpace(c.Query("organizationId"))
	if organizationID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "organizationId is required"})
		return
	}
	userCtx, _ := authctx.UserFromGin(c)
	userID := strings.TrimSpace(c.Query("userId"))
	if userID == "" {
		userID = userCtx.ID
	}

	results, err := h.service.Suggest(c.Request.Context(), query, limit, organizationID, userID)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	rest.Ok(c, gin.H{"results": results})
}

func filterTypes(raw []string) []string {
	types := make([]string, 0, len(raw))
	for _, t := range raw {
		switch strings.TrimSpace(strings.ToLower(t)) {
		case contracts.SearchTypeTask:
			types = append(types, contracts.SearchTypeTask)
		case contracts.SearchTypeComment:
			types = append(types, contracts.SearchTypeComment)
		case contracts.SearchTypeUser:
			types = append(types, contracts.SearchTypeUser)
		}
	}
	return types
}
