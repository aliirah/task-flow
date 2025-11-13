package task

import (
	taskpb "github.com/aliirah/task-flow/shared/proto/task/v1"
	userpb "github.com/aliirah/task-flow/shared/proto/user/v1"
	"github.com/aliirah/task-flow/shared/transform/common"
	usertransform "github.com/aliirah/task-flow/shared/transform/user"
	"github.com/gin-gonic/gin"
)

// CommentToMap converts a comment proto into a gin.H map suitable for HTTP responses.
// This function recursively converts nested replies.
func CommentToMap(comment *taskpb.Comment) gin.H {
	if comment == nil {
		return gin.H{}
	}

	result := gin.H{
		"id":             comment.GetId(),
		"taskId":         comment.GetTaskId(),
		"userId":         comment.GetUserId(),
		"content":        comment.GetContent(),
		"mentionedUsers": comment.GetMentionedUsers(),
		"createdAt":      common.TimestampToString(comment.GetCreatedAt()),
		"updatedAt":      common.TimestampToString(comment.GetUpdatedAt()),
	}

	if comment.GetParentCommentId() != "" {
		result["parentCommentId"] = comment.GetParentCommentId()
	}

	// Recursively convert replies
	if len(comment.GetReplies()) > 0 {
		replies := make([]gin.H, 0, len(comment.GetReplies()))
		for _, reply := range comment.GetReplies() {
			replies = append(replies, CommentToMap(reply))
		}
		result["replies"] = replies
	}

	return result
}

// CommentDetailOptions allows enriching a comment map with related entities.
type CommentDetailOptions struct {
	User    *userpb.User
	Replies []*taskpb.Comment
}

// CommentToDetailedMap converts a comment proto and related entities into a gin.H suitable for responses.
func CommentToDetailedMap(comment *taskpb.Comment, opts CommentDetailOptions) gin.H {
	item := CommentToMap(comment)

	if opts.User != nil {
		item["user"] = usertransform.ToMap(opts.User)
	}

	if opts.Replies != nil && len(opts.Replies) > 0 {
		replies := make([]gin.H, 0, len(opts.Replies))
		for _, reply := range opts.Replies {
			replies = append(replies, CommentToMap(reply))
		}
		item["replies"] = replies
	}

	return item
}
