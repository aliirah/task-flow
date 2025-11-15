package service

import (
	"context"
	"fmt"

	"github.com/aliirah/task-flow/services/task-service/internal/models"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

// UpdateTaskMentionedUsers aggregates all mentioned users from comments and updates the task
func (s *Service) UpdateTaskMentionedUsers(ctx context.Context, taskID uuid.UUID) error {
	// Get all comments for this task
	var comments []models.Comment
	if err := s.db.WithContext(ctx).
		Where("task_id = ?", taskID).
		Find(&comments).Error; err != nil {
		return fmt.Errorf("failed to fetch comments: %w", err)
	}

	// Aggregate unique mentioned users
	mentionedSet := make(map[string]bool)
	for _, comment := range comments {
		for _, userID := range comment.MentionedUsers {
			if userID != "" {
				mentionedSet[userID] = true
			}
		}
	}

	// Convert to slice
	mentionedUsers := make([]string, 0, len(mentionedSet))
	for userID := range mentionedSet {
		mentionedUsers = append(mentionedUsers, userID)
	}

	// Update task using pq.StringArray to properly handle PostgreSQL array type
	if err := s.db.WithContext(ctx).
		Model(&models.Task{}).
		Where("id = ?", taskID).
		Update("mentioned_users", pq.StringArray(mentionedUsers)).Error; err != nil {
		return fmt.Errorf("failed to update task mentioned users: %w", err)
	}

	return nil
}
