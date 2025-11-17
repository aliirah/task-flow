package handler

import (
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/aliirah/task-flow/services/search-service/internal/reindexer"
	"github.com/aliirah/task-flow/services/search-service/internal/search"
)

type Handler struct {
	search        *search.Service
	reindexer     *reindexer.Reindexer
	internalToken string
}

func New(searchSvc *search.Service, reindexer *reindexer.Reindexer, internalToken string) *Handler {
	return &Handler{
		search:        searchSvc,
		reindexer:     reindexer,
		internalToken: internalToken,
	}
}

func (h *Handler) Register(r *gin.Engine) {
	r.GET("/search", h.handleSearch)
	r.GET("/search/suggest", h.handleSuggest)
	r.POST("/internal/reindex", h.handleReindex)
}

func (h *Handler) handleSearch(c *gin.Context) {
	query := strings.TrimSpace(c.Query("q"))
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing query"})
		return
	}

	limit := 20
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil {
			limit = parsed
		}
	}

	docTypes := search.ParseDocumentTypes(strings.Split(c.Query("types"), ","))

	results, err := h.search.Search(c.Request.Context(), query, docTypes, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, results)
}

func (h *Handler) handleSuggest(c *gin.Context) {
	query := strings.TrimSpace(c.Query("q"))
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing query"})
		return
	}

	limit := 8
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil {
			limit = parsed
		}
	}

	results, err := h.search.Suggest(c.Request.Context(), query, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"results": results})
}

func (h *Handler) handleReindex(c *gin.Context) {
	if h.reindexer == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "reindexer not configured"})
		return
	}

	if h.internalToken != "" {
		token := c.GetHeader("X-Internal-Token")
		if token == "" || token != h.internalToken {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
	}

	var payload struct {
		Types []string `json:"types"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil && err != io.EOF {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	var docTypes []search.DocumentType
	if len(payload.Types) > 0 {
		docTypes = search.ParseDocumentTypes(payload.Types)
	}

	if err := h.reindexer.Reindex(c.Request.Context(), docTypes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
