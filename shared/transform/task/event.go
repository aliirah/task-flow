package task

import (
	"github.com/aliirah/task-flow/shared/contracts"
	taskpb "github.com/aliirah/task-flow/shared/proto/task/v1"
	"github.com/aliirah/task-flow/shared/transform/common"
)

// ToCreatedEvent converts a task proto into a TaskCreatedEvent payload.
func ToCreatedEvent(task *taskpb.Task) contracts.TaskCreatedEvent {
	if task == nil {
		return contracts.TaskCreatedEvent{}
	}

	return contracts.TaskCreatedEvent{
		TaskID:         task.GetId(),
		OrganizationID: task.GetOrganizationId(),
		Title:          task.GetTitle(),
		Description:    task.GetDescription(),
		Status:         task.GetStatus(),
		Priority:       task.GetPriority(),
		ReporterID:     task.GetReporterId(),
		AssigneeID:     task.GetAssigneeId(),
		DueAt:          common.TimestampToString(task.GetDueAt()),
		CreatedAt:      common.TimestampToString(task.GetCreatedAt()),
		UpdatedAt:      common.TimestampToString(task.GetUpdatedAt()),
	}
}
