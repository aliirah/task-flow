package task

import (
	taskpb "github.com/aliirah/task-flow/shared/proto/task/v1"
	"github.com/aliirah/task-flow/shared/transform/common"
	"github.com/gin-gonic/gin"
)

// ToMap converts a task proto into a gin.H map suitable for HTTP responses.
func ToMap(task *taskpb.Task) gin.H {
	if task == nil {
		return gin.H{}
	}
	return gin.H{
		"id":             task.GetId(),
		"title":          task.GetTitle(),
		"description":    task.GetDescription(),
		"status":         task.GetStatus(),
		"priority":       task.GetPriority(),
		"organizationId": task.GetOrganizationId(),
		"assigneeId":     task.GetAssigneeId(),
		"reporterId":     task.GetReporterId(),
		"dueAt":          common.TimestampToString(task.GetDueAt()),
		"createdAt":      common.TimestampToString(task.GetCreatedAt()),
		"updatedAt":      common.TimestampToString(task.GetUpdatedAt()),
	}
}
