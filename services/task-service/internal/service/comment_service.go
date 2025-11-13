package service

import (
	"context"
	"errors"
	"regexp"
	"strings"

	"github.com/aliirah/task-flow/services/task-service/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CreateCommentInput struct {
	TaskID          uuid.UUID
	UserID          uuid.UUID
	ParentCommentID *uuid.UUID
	Content         string
	MentionedUsers  []string
}

type UpdateCommentInput struct {
	Content        string
	MentionedUsers []string
}

type ListCommentsParams struct {
	TaskID         uuid.UUID
	Page           int
	Limit          int
	IncludeReplies bool
}

// ExtractMentions extracts @username mentions from content
func ExtractMentions(content string) []string {
	re := regexp.MustCompile(`@(\w+)`)
	matches := re.FindAllStringSubmatch(content, -1)
	
	mentions := make([]string, 0)
	seen := make(map[string]bool)
	
	for _, match := range matches {
		if len(match) > 1 {
			username := match[1]
			if !seen[username] {
				mentions = append(mentions, username)
				seen[username] = true
			}
		}
	}
	
	return mentions
}

func (s *Service) CreateComment(ctx context.Context, input CreateCommentInput) (*models.Comment, error) {
	// Validate task exists
	var task models.Task
	if err := s.db.WithContext(ctx).First(&task, "id = ?", input.TaskID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("task not found")
		}
		return nil, err
	}

	// Validate user is a member of the task's organization
	if err := s.ValidateOrganizationMembership(ctx, input.UserID, task.OrganizationID); err != nil {
		return nil, err
	}

	// Validate parent comment if provided (Jira-style: unlimited nesting allowed)
	if input.ParentCommentID != nil && *input.ParentCommentID != uuid.Nil {
		var parentComment models.Comment
		if err := s.db.WithContext(ctx).First(&parentComment, "id = ? AND task_id = ?", input.ParentCommentID, input.TaskID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, errors.New("parent comment not found")
			}
			return nil, err
		}
	}

	// Clean content
	content := strings.TrimSpace(input.Content)
	if content == "" {
		return nil, errors.New("content cannot be empty")
	}

	// Extract mentions if not provided
	mentions := input.MentionedUsers
	if len(mentions) == 0 {
		mentions = ExtractMentions(content)
	}

	comment := &models.Comment{
		TaskID:          input.TaskID,
		UserID:          input.UserID,
		ParentCommentID: input.ParentCommentID,
		Content:         content,
		MentionedUsers:  mentions,
	}

	if err := s.db.WithContext(ctx).Create(comment).Error; err != nil {
		return nil, err
	}

	return comment, nil
}

func (s *Service) GetComment(ctx context.Context, id uuid.UUID) (*models.Comment, error) {
	var comment models.Comment
	if err := s.db.WithContext(ctx).
		Preload("Task").
		First(&comment, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &comment, nil
}

func (s *Service) ListComments(ctx context.Context, params ListCommentsParams) ([]models.Comment, bool, error) {
	if params.Page <= 0 {
		params.Page = 1
	}
	if params.Limit <= 0 {
		params.Limit = 20
	}

	offset := (params.Page - 1) * params.Limit
	query := s.db.WithContext(ctx).Model(&models.Comment{}).
		Where("task_id = ?", params.TaskID).
		Order("created_at DESC")

	// If not including replies, only get parent comments
	if !params.IncludeReplies {
		query = query.Where("parent_comment_id IS NULL")
	}

	// Fetch one extra to check if there are more
	var comments []models.Comment
	if err := query.Offset(offset).Limit(params.Limit + 1).Find(&comments).Error; err != nil {
		return nil, false, err
	}

	hasMore := len(comments) > params.Limit
	if hasMore {
		comments = comments[:params.Limit]
	}

	return comments, hasMore, nil
}

func (s *Service) UpdateComment(ctx context.Context, id uuid.UUID, input UpdateCommentInput, userID uuid.UUID) (*models.Comment, error) {
	comment, err := s.GetComment(ctx, id)
	if err != nil {
		return nil, err
	}

	// Validate user is a member of the task's organization
	if comment.Task != nil {
		if err := s.ValidateOrganizationMembership(ctx, userID, comment.Task.OrganizationID); err != nil {
			return nil, err
		}
	}

	// Only the author can update the comment
	if comment.UserID != userID {
		return nil, errors.New("unauthorized: only comment author can update")
	}

	// Clean content
	content := strings.TrimSpace(input.Content)
	if content == "" {
		return nil, errors.New("content cannot be empty")
	}

	// Extract mentions if not provided
	mentions := input.MentionedUsers
	if len(mentions) == 0 {
		mentions = ExtractMentions(content)
	}

	updates := map[string]interface{}{
		"content":         content,
		"mentioned_users": mentions,
	}

	if err := s.db.WithContext(ctx).Model(comment).Updates(updates).Error; err != nil {
		return nil, err
	}

	// Reload to get updated data
	return s.GetComment(ctx, id)
}

func (s *Service) DeleteComment(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	comment, err := s.GetComment(ctx, id)
	if err != nil {
		return err
	}

	// Validate user is a member of the task's organization
	if comment.Task != nil {
		if err := s.ValidateOrganizationMembership(ctx, userID, comment.Task.OrganizationID); err != nil {
			return err
		}
	}

	// Only the author can delete the comment
	if comment.UserID != userID {
		return errors.New("unauthorized: only comment author can delete")
	}

	// Soft delete
	if err := s.db.WithContext(ctx).Delete(comment).Error; err != nil {
		return err
	}

	return nil
}

// GetReplies fetches replies for a specific comment
func (s *Service) GetReplies(ctx context.Context, parentCommentID uuid.UUID) ([]models.Comment, error) {
	var replies []models.Comment
	if err := s.db.WithContext(ctx).
		Where("parent_comment_id = ?", parentCommentID).
		Order("created_at ASC").
		Find(&replies).Error; err != nil {
		return nil, err
	}
	return replies, nil
}
