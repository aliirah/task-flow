package user

import (
	userpb "github.com/aliirah/task-flow/shared/proto/user/v1"
	"github.com/gin-gonic/gin"
)

// ToMap converts a user proto into a gin.H for HTTP responses.
func ToMap(user *userpb.User) gin.H {
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
