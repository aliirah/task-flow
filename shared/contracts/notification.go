package contracts

// Notification event types
const (
	NotificationEventTaskCreated      = "notification.task.created"
	NotificationEventTaskUpdated      = "notification.task.updated"
	NotificationEventTaskDeleted      = "notification.task.deleted"
	NotificationEventCommentCreated   = "notification.comment.created"
	NotificationEventCommentUpdated   = "notification.comment.updated"
	NotificationEventCommentDeleted   = "notification.comment.deleted"
	NotificationEventCommentMentioned = "notification.comment.mentioned"
)

// NotificationEvent is the base structure for all notification events
type NotificationEvent struct {
	OrganizationID string   `json:"organizationId"`
	TriggerUserID  string   `json:"triggerUserId"` // Who triggered the action
	Recipients     []string `json:"recipients"`    // User IDs who should receive notification
	EventType      string   `json:"eventType"`
	Data           any      `json:"data"`
}

// TaskNotificationData contains task-related notification data
type TaskNotificationData struct {
	TaskID         string    `json:"taskId"`
	Title          string    `json:"title"`
	Description    string    `json:"description,omitempty"`
	Status         string    `json:"status"`
	Priority       string    `json:"priority"`
	AssigneeID     string    `json:"assigneeId,omitempty"`
	ReporterID     string    `json:"reporterId,omitempty"`
	Assignee       *TaskUser `json:"assignee,omitempty"`
	Reporter       *TaskUser `json:"reporter,omitempty"`
	TriggerUser    *TaskUser `json:"triggerUser,omitempty"`
	DueAt          string    `json:"dueAt,omitempty"`
	Changes        *TaskChanges `json:"changes,omitempty"` // For updates
}

// TaskChanges tracks what changed in a task update
type TaskChanges struct {
	Title       *FieldChange `json:"title,omitempty"`
	Description *FieldChange `json:"description,omitempty"`
	Status      *FieldChange `json:"status,omitempty"`
	Priority    *FieldChange `json:"priority,omitempty"`
	AssigneeID  *FieldChange `json:"assigneeId,omitempty"`
	DueAt       *FieldChange `json:"dueAt,omitempty"`
}

// FieldChange represents before/after values
type FieldChange struct {
	Old string `json:"old"`
	New string `json:"new"`
}

// CommentNotificationData contains comment-related notification data
type CommentNotificationData struct {
	CommentID      string   `json:"commentId"`
	TaskID         string   `json:"taskId"`
	TaskTitle      string   `json:"taskTitle"`
	Content        string   `json:"content"`
	ParentCommentID string  `json:"parentCommentId,omitempty"`
	AuthorID       string   `json:"authorId"`
	Author         *TaskUser `json:"author,omitempty"`
	TriggerUser    *TaskUser `json:"triggerUser,omitempty"`
	MentionedUsers []string `json:"mentionedUsers,omitempty"`
}
