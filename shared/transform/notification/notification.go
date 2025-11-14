package notification

import (
	notificationpb "github.com/aliirah/task-flow/shared/proto/notification/v1"
)

// NotificationResponse is the HTTP response structure for notifications
type NotificationResponse struct {
	ID             string  `json:"id"`
	UserID         string  `json:"userId"`
	OrganizationID string  `json:"organizationId"`
	TriggerUserID  string  `json:"triggerUserId"`
	Type           string  `json:"type"`
	EntityType     string  `json:"entityType"`
	EntityID       string  `json:"entityId"`
	Title          string  `json:"title"`
	Message        string  `json:"message"`
	URL            string  `json:"url"`
	Data           string  `json:"data"`
	IsRead         bool    `json:"isRead"`
	ReadAt         *string `json:"readAt,omitempty"`
	CreatedAt      string  `json:"createdAt"`
	UpdatedAt      string  `json:"updatedAt"`
}

// ToHTTP converts a protobuf Notification to HTTP response format
func ToHTTP(pb *notificationpb.Notification) NotificationResponse {
	if pb == nil {
		return NotificationResponse{}
	}

	resp := NotificationResponse{
		ID:             pb.Id,
		UserID:         pb.UserId,
		OrganizationID: pb.OrganizationId,
		TriggerUserID:  pb.TriggerUserId,
		Type:           pb.Type,
		EntityType:     pb.EntityType,
		EntityID:       pb.EntityId,
		Title:          pb.Title,
		Message:        pb.Message,
		URL:            pb.Url,
		Data:           pb.Data,
		IsRead:         pb.IsRead,
	}

	if pb.ReadAt != nil && pb.ReadAt.IsValid() {
		readAt := pb.ReadAt.AsTime().Format("2006-01-02T15:04:05Z07:00")
		resp.ReadAt = &readAt
	}

	if pb.CreatedAt != nil && pb.CreatedAt.IsValid() {
		resp.CreatedAt = pb.CreatedAt.AsTime().Format("2006-01-02T15:04:05Z07:00")
	}

	if pb.UpdatedAt != nil && pb.UpdatedAt.IsValid() {
		resp.UpdatedAt = pb.UpdatedAt.AsTime().Format("2006-01-02T15:04:05Z07:00")
	}

	return resp
}

// ToHTTPList converts a list of protobuf Notifications to HTTP response format
func ToHTTPList(pbs []*notificationpb.Notification) []NotificationResponse {
	if pbs == nil {
		return []NotificationResponse{}
	}

	result := make([]NotificationResponse, len(pbs))
	for i, pb := range pbs {
		result[i] = ToHTTP(pb)
	}
	return result
}
