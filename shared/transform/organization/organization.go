package organization

import (
	organizationpb "github.com/aliirah/task-flow/shared/proto/organization/v1"
	"github.com/aliirah/task-flow/shared/transform/common"
	"github.com/gin-gonic/gin"
)

// ToMap converts an organization proto into a gin.H suitable for JSON responses.
func ToMap(org *organizationpb.Organization) gin.H {
	if org == nil {
		return gin.H{}
	}
	return gin.H{
		"id":          org.GetId(),
		"name":        org.GetName(),
		"description": org.GetDescription(),
		"ownerId":     org.GetOwnerId(),
		"createdAt":   common.TimestampToString(org.GetCreatedAt()),
		"updatedAt":   common.TimestampToString(org.GetUpdatedAt()),
	}
}
