package organization

import (
	organizationpb "github.com/aliirah/task-flow/shared/proto/organization/v1"
	"github.com/aliirah/task-flow/shared/transform/common"
	"github.com/gin-gonic/gin"
)

// MemberToMap converts an organization member proto to a gin.H representation.
func MemberToMap(member *organizationpb.OrganizationMember) gin.H {
	if member == nil {
		return gin.H{}
	}
	return gin.H{
		"id":             member.GetId(),
		"organizationId": member.GetOrganizationId(),
		"userId":         member.GetUserId(),
		"role":           member.GetRole(),
		"status":         member.GetStatus(),
		"createdAt":      common.TimestampToString(member.GetCreatedAt()),
	}
}
