package httputil

import (
	"time"

	organizationpb "github.com/aliirah/task-flow/shared/proto/organization/v1"
	userpb "github.com/aliirah/task-flow/shared/proto/user/v1"
	"github.com/gin-gonic/gin"
	timestamppb "google.golang.org/protobuf/types/known/timestamppb"
)

// TimestampToString renders protobuf timestamps in a consistent ISO-8601 format.
func TimestampToString(ts *timestamppb.Timestamp) string {
	if ts == nil {
		return ""
	}
	return ts.AsTime().UTC().Format(time.RFC3339)
}

// OrganizationToMap converts an organization proto into a gin.H representation.
func OrganizationToMap(org *organizationpb.Organization) gin.H {
	if org == nil {
		return gin.H{}
	}
	return gin.H{
		"id":          org.GetId(),
		"name":        org.GetName(),
		"description": org.GetDescription(),
		"ownerId":     org.GetOwnerId(),
		"createdAt":   TimestampToString(org.GetCreatedAt()),
		"updatedAt":   TimestampToString(org.GetUpdatedAt()),
	}
}

// UserToMap converts a user proto into a gin.H representation.
func UserToMap(user *userpb.User) gin.H {
	if user == nil {
		return gin.H{}
	}
	return gin.H{
		"id":        user.GetId(),
		"email":     user.GetEmail(),
		"firstName": user.GetFirstName(),
		"lastName":  user.GetLastName(),
		"status":    user.GetStatus(),
		"userType":  user.GetUserType(),
		"roles":     user.GetRoles(),
	}
}
