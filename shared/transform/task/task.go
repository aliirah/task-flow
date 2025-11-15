package task

import (
	organizationpb "github.com/aliirah/task-flow/shared/proto/organization/v1"
	taskpb "github.com/aliirah/task-flow/shared/proto/task/v1"
	userpb "github.com/aliirah/task-flow/shared/proto/user/v1"
	"github.com/aliirah/task-flow/shared/transform/common"
	orgtransform "github.com/aliirah/task-flow/shared/transform/organization"
	usertransform "github.com/aliirah/task-flow/shared/transform/user"
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
		"type":           task.GetType(),
		"organizationId": task.GetOrganizationId(),
		"assigneeId":     task.GetAssigneeId(),
		"reporterId":     task.GetReporterId(),
		"parentTaskId":   task.GetParentTaskId(),
		"displayOrder":   task.GetDisplayOrder(),
		"dueAt":          common.TimestampToString(task.GetDueAt()),
		"createdAt":      common.TimestampToString(task.GetCreatedAt()),
		"updatedAt":      common.TimestampToString(task.GetUpdatedAt()),
	}
}

// DetailOptions allows enriching a task map with related entities.
type DetailOptions struct {
	Organization   *organizationpb.Organization
	OrganizationID string
	Assignee       *userpb.User
	AssigneeID     string
	Reporter       *userpb.User
	ReporterID     string
}

// ToDetailedMap converts a task proto and related entities into a gin.H suitable for responses.
func ToDetailedMap(task *taskpb.Task, opts DetailOptions) gin.H {
	item := ToMap(task)

	orgID := opts.OrganizationID
	if orgID == "" && task != nil {
		orgID = task.GetOrganizationId()
	}
	if opts.Organization != nil {
		item["organization"] = orgtransform.ToMap(opts.Organization)
	} else if orgID != "" {
		item["organization"] = gin.H{"id": orgID}
	}

	assigneeID := opts.AssigneeID
	if assigneeID == "" && task != nil {
		assigneeID = task.GetAssigneeId()
	}
	if opts.Assignee != nil {
		item["assignee"] = usertransform.ToMap(opts.Assignee)
	} else if assigneeID != "" {
		item["assignee"] = gin.H{
			"id":        assigneeID,
			"email":     "",
			"firstName": "",
			"lastName":  "",
			"status":    "",
			"userType":  "",
			"roles":     []string{},
		}
	}

	reporterID := opts.ReporterID
	if reporterID == "" && task != nil {
		reporterID = task.GetReporterId()
	}
	if opts.Reporter != nil {
		item["reporter"] = usertransform.ToMap(opts.Reporter)
	} else if reporterID != "" {
		item["reporter"] = gin.H{
			"id":        reporterID,
			"email":     "",
			"firstName": "",
			"lastName":  "",
			"status":    "",
			"userType":  "",
			"roles":     []string{},
		}
	}

	return item
}
