package service

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"

	"github.com/aliirah/task-flow/services/task-service/internal/models"
	"github.com/aliirah/task-flow/shared/contracts"
	userpb "github.com/aliirah/task-flow/shared/proto/user/v1"
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

	// Publish notification events
	go s.publishCommentNotifications(ctx, &task, comment, nil, mentions)

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
	
	// Always get only parent comments for pagination
	query := s.db.WithContext(ctx).Model(&models.Comment{}).
		Where("task_id = ? AND parent_comment_id IS NULL", params.TaskID).
		Order("created_at DESC")

	// Fetch one extra to check if there are more
	var comments []models.Comment
	if err := query.Offset(offset).Limit(params.Limit + 1).Find(&comments).Error; err != nil {
		return nil, false, err
	}

	hasMore := len(comments) > params.Limit
	if hasMore {
		comments = comments[:params.Limit]
	}

	// If including replies, load nested replies for each parent comment
	if params.IncludeReplies {
		for i := range comments {
			if err := s.loadRepliesRecursive(ctx, &comments[i]); err != nil {
				return nil, false, err
			}
		}
	}

	return comments, hasMore, nil
}

// loadRepliesRecursive loads all nested replies for a comment
func (s *Service) loadRepliesRecursive(ctx context.Context, comment *models.Comment) error {
	var replies []models.Comment
	if err := s.db.WithContext(ctx).
		Where("parent_comment_id = ?", comment.ID).
		Order("created_at ASC").
		Find(&replies).Error; err != nil {
		return err
	}

	if len(replies) > 0 {
		comment.Replies = replies
		// Recursively load replies for each reply
		for i := range comment.Replies {
			if err := s.loadRepliesRecursive(ctx, &comment.Replies[i]); err != nil {
				return err
			}
		}
	}

	return nil
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

	// Track old mentions for notification
	oldMentions := comment.MentionedUsers

	// Update the comment fields directly
	comment.Content = content
	comment.MentionedUsers = mentions

	if err := s.db.WithContext(ctx).Save(comment).Error; err != nil {
		return nil, err
	}

	// Publish notification for newly mentioned users
	if len(mentions) > 0 {
		// Find new mentions (in mentions but not in oldMentions)
		newMentions := []string{}
		oldMentionSet := make(map[string]bool)
		for _, m := range oldMentions {
			oldMentionSet[m] = true
		}
		for _, m := range mentions {
			if !oldMentionSet[m] {
				newMentions = append(newMentions, m)
			}
		}

		if len(newMentions) > 0 {
			// Fetch task for organization ID
			var task models.Task
			if err := s.db.WithContext(ctx).First(&task, "id = ?", comment.TaskID).Error; err == nil {
				go s.publishCommentUpdateNotifications(ctx, &task, comment, newMentions)
			}
		}
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

// publishCommentNotifications publishes comment notification events
func (s *Service) publishCommentNotifications(ctx context.Context, task *models.Task, comment *models.Comment, oldMentions, newMentions []string) {
	if s.notifPublisher == nil {
		return
	}

	// Fetch author details
var author *userpb.User
resp, err := s.userSvc.GetUser(ctx, &userpb.GetUserRequest{
	Id: comment.UserID.String(),
})
if err == nil && resp != nil {
	author = resp
}

// Build recipients list
recipients := []uuid.UUID{}
recipientSet := make(map[uuid.UUID]bool)	// Add task assignee if not the comment author
	if task.AssigneeID != uuid.Nil && task.AssigneeID != comment.UserID {
		recipientSet[task.AssigneeID] = true
	}

	// Add task reporter if not the comment author
	if task.ReporterID != uuid.Nil && task.ReporterID != comment.UserID {
		recipientSet[task.ReporterID] = true
	}

	// Add parent comment author if this is a reply
	if comment.ParentCommentID != nil && *comment.ParentCommentID != uuid.Nil {
		var parentComment models.Comment
		if err := s.db.WithContext(ctx).First(&parentComment, "id = ?", comment.ParentCommentID).Error; err == nil {
			if parentComment.UserID != comment.UserID {
				recipientSet[parentComment.UserID] = true
			}
		}
	}

	// Convert set to slice
	for recipientID := range recipientSet {
		recipients = append(recipients, recipientID)
	}

	// Publish comment created event
	if len(recipients) > 0 {
		// Convert UUIDs to strings
		recipientStrs := make([]string, len(recipients))
		for i, id := range recipients {
			recipientStrs[i] = id.String()
		}

		commentData := &contracts.CommentNotificationData{
			CommentID: comment.ID.String(),
			TaskID:    task.ID.String(),
			TaskTitle: task.Title,
			Content:   comment.Content,
			AuthorID:  comment.UserID.String(),
			Author: &contracts.TaskUser{
				ID:        comment.UserID.String(),
				FirstName: author.FirstName,
				LastName:  author.LastName,
				Email:     author.Email,
			},
		}
		if err := s.notifPublisher.PublishCommentCreated(ctx, task.OrganizationID.String(), comment.UserID.String(), recipientStrs, commentData); err != nil {
			fmt.Printf("failed to publish comment created notification: %v\n", err)
		}
	}

	// Publish mention notifications
	mentionedUserIDs := []uuid.UUID{}
	for _, username := range newMentions {
		// Fetch user by username using ListUsers query
		listResp, err := s.userSvc.ListUsers(ctx, &userpb.ListUsersRequest{
			Query: username,
			Limit: 1,
		})
		if err == nil && listResp != nil && len(listResp.Items) > 0 {
			user := listResp.Items[0]
			if user.Id != comment.UserID.String() {
				userID, err := uuid.Parse(user.Id)
				if err == nil {
					// Don't send mention notification if already in recipients (avoid duplicate)
					if !recipientSet[userID] {
						mentionedUserIDs = append(mentionedUserIDs, userID)
					}
				}
			}
		}
	}

	if len(mentionedUserIDs) > 0 {
		// Convert UUIDs to strings
		mentionedStrs := make([]string, len(mentionedUserIDs))
		for i, id := range mentionedUserIDs {
			mentionedStrs[i] = id.String()
		}

		commentData := &contracts.CommentNotificationData{
			CommentID: comment.ID.String(),
			TaskID:    task.ID.String(),
			TaskTitle: task.Title,
			Content:   comment.Content,
			AuthorID:  comment.UserID.String(),
			Author: &contracts.TaskUser{
				ID:        comment.UserID.String(),
				FirstName: author.FirstName,
				LastName:  author.LastName,
				Email:     author.Email,
			},
			MentionedUsers: newMentions,
		}
		if err := s.notifPublisher.PublishCommentMention(ctx, task.OrganizationID.String(), comment.UserID.String(), mentionedStrs, commentData); err != nil {
			fmt.Printf("failed to publish comment mention notification: %v\n", err)
		}
	}
}

// publishCommentUpdateNotifications publishes notifications for newly mentioned users in comment updates
func (s *Service) publishCommentUpdateNotifications(ctx context.Context, task *models.Task, comment *models.Comment, newMentions []string) {
	if s.notifPublisher == nil || len(newMentions) == 0 {
		return
	}

	// Fetch author details
	var author *userpb.User
	resp, err := s.userSvc.GetUser(ctx, &userpb.GetUserRequest{
		Id: comment.UserID.String(),
	})
	if err == nil && resp != nil {
		author = resp
	}

	// Fetch mentioned user IDs
	mentionedUserIDs := []uuid.UUID{}
	for _, username := range newMentions {
		// Fetch user by username using ListUsers query
		listResp, err := s.userSvc.ListUsers(ctx, &userpb.ListUsersRequest{
			Query: username,
			Limit: 1,
		})
		if err == nil && listResp != nil && len(listResp.Items) > 0 {
			user := listResp.Items[0]
			if user.Id != comment.UserID.String() {
				userID, err := uuid.Parse(user.Id)
				if err == nil {
					mentionedUserIDs = append(mentionedUserIDs, userID)
				}
			}
		}
	}

	if len(mentionedUserIDs) > 0 {
		// Convert UUIDs to strings
		mentionedStrs := make([]string, len(mentionedUserIDs))
		for i, id := range mentionedUserIDs {
			mentionedStrs[i] = id.String()
		}

		commentData := &contracts.CommentNotificationData{
			CommentID: comment.ID.String(),
			TaskID:    task.ID.String(),
			TaskTitle: task.Title,
			Content:   comment.Content,
			AuthorID:  comment.UserID.String(),
			Author: &contracts.TaskUser{
				ID:        comment.UserID.String(),
				FirstName: author.FirstName,
				LastName:  author.LastName,
				Email:     author.Email,
			},
			MentionedUsers: newMentions,
		}
		if err := s.notifPublisher.PublishCommentMention(ctx, task.OrganizationID.String(), comment.UserID.String(), mentionedStrs, commentData); err != nil {
			fmt.Printf("failed to publish comment mention notification: %v\n", err)
		}
	}
}
