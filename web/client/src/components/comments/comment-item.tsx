'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Comment, User } from '@/lib/types/api'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { CommentEditor } from './comment-editor'
import { MessageSquare, Pencil, Trash2 } from 'lucide-react'

interface CommentItemProps {
  comment: Comment
  currentUserId: string
  users: User[]
  onReply: (parentId: string, content: string, mentionedUsers: string[]) => Promise<void>
  onEdit: (id: string, content: string, mentionedUsers: string[]) => Promise<void>
  onDelete: (id: string) => Promise<void>
  depth?: number
}

export function CommentItem({
  comment,
  currentUserId,
  users,
  onReply,
  onEdit,
  onDelete,
  depth = 0,
}: CommentItemProps) {
  const [isReplying, setIsReplying] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const isAuthor = comment.userId === currentUserId
  const author = comment.user || users.find((u) => u.id === comment.userId)
  
  const authorName = author
    ? `${author.firstName} ${author.lastName}`.trim() || author.email
    : 'Unknown'
  
  const authorInitial = author
    ? (author.firstName?.[0] || author.email[0]).toUpperCase()
    : '?'

  const handleReply = async (content: string, mentionedUsers: string[]) => {
    await onReply(comment.id, content, mentionedUsers)
    setIsReplying(false)
  }

  const handleEdit = async (content: string, mentionedUsers: string[]) => {
    await onEdit(comment.id, content, mentionedUsers)
    setIsEditing(false)
  }

  const handleDeleteConfirm = async () => {
    try {
      setDeleteLoading(true)
      await onDelete(comment.id)
      setDeleteOpen(false)
    } catch (error) {
      console.error('Failed to delete comment:', error)
    } finally {
      setDeleteLoading(false)
    }
  }

  const getTimeAgo = () => {
    try {
      if (!comment.createdAt) {
        return 'just now'
      }
      
      // Try to parse the date - handle multiple formats
      let date: Date
      
      // Check if it's a timestamp (number as string)
      if (/^\d+$/.test(comment.createdAt)) {
        date = new Date(parseInt(comment.createdAt))
      } 
      // Check if it's RFC3339/ISO format
      else if (comment.createdAt.includes('T') || comment.createdAt.includes('Z')) {
        date = new Date(comment.createdAt)
      }
      // Try parsing as-is
      else {
        date = new Date(comment.createdAt)
      }
      
      if (isNaN(date.getTime())) {
        return 'just now'
      }
      
      return formatDistanceToNow(date, { addSuffix: true })
    } catch (error) {
      console.error('Error parsing date:', error, comment.createdAt)
      return 'just now'
    }
  }

  const timeAgo = getTimeAgo()
  const hasReplies = comment.replies && comment.replies.length > 0

  return (
    <div className={depth > 0 ? 'ml-2.5 mt-2.5 border-l border-slate-200 pl-2.5' : 'mt-3'}>
      <div className="flex gap-2.5">
        {/* Avatar */}
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-blue-500 to-purple-600 text-[11px] font-semibold text-white">
          {authorInitial}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-900">{authorName}</span>
            <span className="text-[11px] text-slate-400">{timeAgo}</span>
          </div>

          {isEditing ? (
            <div className="mt-2">
              <CommentEditor
                onSubmit={handleEdit}
                onCancel={() => setIsEditing(false)}
                placeholder="Edit your comment..."
                initialContent={comment.content}
                initialMentions={comment.mentionedUsers}
                autoFocus
                users={users}
                submitLabel="Save"
              />
            </div>
          ) : (
            <>
              <div
                className="prose prose-sm mt-1 max-w-none text-[13px] leading-relaxed text-slate-700"
                dangerouslySetInnerHTML={{ __html: comment.content }}
              />

              {/* Actions */}
              <div className="mt-1.5 flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsReplying(!isReplying)}
                  className="h-auto px-0 py-0 text-xs font-medium text-slate-500 hover:bg-transparent hover:text-blue-600"
                >
                  <MessageSquare className="mr-1 size-3" />
                  Reply
                </Button>

                {isAuthor && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditing(true)}
                      className="h-auto px-0 py-0 text-xs font-medium text-slate-500 hover:bg-transparent hover:text-blue-600"
                    >
                      <Pencil className="mr-1 size-3" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteOpen(true)}
                      className="h-auto px-0 py-0 text-xs font-medium text-slate-500 hover:bg-transparent hover:text-red-600"
                    >
                      <Trash2 className="mr-1 size-3" />
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </>
          )}

          {/* Reply Form */}
          {isReplying && (
            <div className="mt-3">
              <CommentEditor
                onSubmit={handleReply}
                onCancel={() => setIsReplying(false)}
                placeholder="Write a reply..."
                autoFocus
                users={users}
                submitLabel="Reply"
              />
            </div>
          )}

          {/* Nested Replies */}
          {hasReplies && (
            <div className="mt-2">
              {comment.replies!.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  currentUserId={currentUserId}
                  users={users}
                  onReply={onReply}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  depth={depth + 1}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteOpen}
        onClose={() => (deleteLoading ? null : setDeleteOpen(false))}
        title="Delete comment"
        description="This action cannot be undone."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setDeleteOpen(false)}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="min-w-[110px]"
              onClick={handleDeleteConfirm}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to delete this comment? This will also delete all replies.
        </p>
      </Modal>
    </div>
  )
}
