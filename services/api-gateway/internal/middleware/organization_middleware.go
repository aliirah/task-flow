package middleware

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/aliirah/task-flow/services/api-gateway/internal/service"
	"github.com/aliirah/task-flow/shared/authctx"
	organizationpb "github.com/aliirah/task-flow/shared/proto/organization/v1"
	"github.com/aliirah/task-flow/shared/rest"
	"github.com/gin-gonic/gin"
)

// RequireOrganizationMember validates that the authenticated user is a member
// of the organization specified in the request (via query param, path param, or body).
// This middleware should be applied after JWTAuth middleware.
func RequireOrganizationMember(orgSvc service.OrganizationService, paramName string) gin.HandlerFunc {
	return func(c *gin.Context) {
		user, ok := authctx.UserFromGin(c)
		if !ok {
			rest.Error(c, http.StatusUnauthorized, "user not authenticated",
				rest.WithErrorCode("auth.not_authenticated"))
			c.Abort()
			return
		}

		// Try to get organization ID from various sources
		var orgID string

		// 1. Try path parameter (e.g., /organizations/:id)
		if paramName != "" {
			orgID = c.Param(paramName)
		}

		// 2. If not in path, try query parameter
		if orgID == "" {
			orgID = c.Query("organizationId")
		}

		// 3. If still empty, try to get from request body (for POST/PUT/PATCH)
		if orgID == "" && (c.Request.Method == "POST" || c.Request.Method == "PUT" || c.Request.Method == "PATCH") {
			// For tasks, the organizationId might be in the body
			// Read the body without consuming it
			bodyBytes, err := c.GetRawData()
			if err == nil && len(bodyBytes) > 0 {
				// Restore the body for downstream handlers
				c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
				
				// Try to extract organizationId
				var body map[string]interface{}
				if err := json.Unmarshal(bodyBytes, &body); err == nil {
					if id, ok := body["organizationId"].(string); ok {
						orgID = id
					}
				}
			}
		}

		if orgID == "" {
			// If no organization ID found, skip validation
			// (Some endpoints like list all tasks might not have org context)
			c.Next()
			return
		}

		orgID = strings.TrimSpace(orgID)
		if orgID == "" {
			c.Next()
			return
		}

		// Check if user is a member of the organization
		resp, err := orgSvc.ListUserMemberships(c.Request.Context(), &organizationpb.ListUserMembershipsRequest{
			UserId: user.ID,
		})
		if err != nil {
			rest.Error(c, http.StatusInternalServerError, "failed to verify organization membership",
				rest.WithErrorCode("organization.membership_check_failed"))
			c.Abort()
			return
		}

		isMember := false
		for _, membership := range resp.GetMemberships() {
			if membership.GetOrganizationId() == orgID {
				isMember = true
				break
			}
		}

		if !isMember {
			rest.Error(c, http.StatusForbidden, "user is not a member of this organization",
				rest.WithErrorCode("organization.not_member"))
			c.Abort()
			return
		}

		// Store organization ID in context for handlers to use
		c.Set("organizationId", orgID)
		c.Next()
	}
}
