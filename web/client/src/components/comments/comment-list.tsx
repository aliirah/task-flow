'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Comment, User } from '@/lib/types/api'
import { commentApi } from '@/lib/api/comment'
import { CommentEditor } from './comment-editor'
import { CommentItem } from './comment-item'
import { Loader2 } from 'lucide-react'

interface CommentListProps {
  taskId: string
  currentUserId: string
  users: User[]
}

export function CommentList({ taskId, currentUserId, users }: CommentListProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const observerTarget = useRef<HTMLDivElement>(null)

  // Load comments
  const loadComments = useCallback(async (pageNum: number, append = false) => {
    if (append) {
      setIsLoadingMore(true)
    } else {
      setIsLoading(true)
    }

    try {
      const response = await commentApi.list(taskId, {
        page: pageNum,
        limit: 20,
        includeReplies: true,
      })

      if (append) {
        setComments((prev) => [...(prev || []), ...(response.data.items || [])])
      } else {
        setComments(response.data.items || [])
      }
      setHasMore(response.data.hasMore || false)
    } catch (error) {
      console.error('Failed to load comments:', error)
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [taskId])

  // Initial load
  useEffect(() => {
    loadComments(1)
  }, [loadComments])

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          const nextPage = page + 1
          setPage(nextPage)
          loadComments(nextPage, true)
        }
      },
      { threshold: 0.1 }
    )

    if (observerTarget.current) {
      observer.observe(observerTarget.current)
    }

    return () => observer.disconnect()
  }, [hasMore, isLoadingMore, page, loadComments])

  // Helper functions for nested operations
  const addReplyToComment = (items: Comment[], parentId: string, reply: Comment): Comment[] => {
    return items.map((item) => {
      if (item.id === parentId) {
        return {
          ...item,
          replies: [...(item.replies || []), reply],
        }
      }
      if (item.replies) {
        return {
          ...item,
          replies: addReplyToComment(item.replies, parentId, reply),
        }
      }
      return item
    })
  }

  const updateCommentInList = (items: Comment[], id: string, updatedComment: Comment): Comment[] => {
    return items.map((item) => {
      if (item.id === id) {
        return { ...item, ...updatedComment }
      }
      if (item.replies) {
        return {
          ...item,
          replies: updateCommentInList(item.replies, id, updatedComment),
        }
      }
      return item
    })
  }

  const removeCommentFromList = (items: Comment[], id: string): Comment[] => {
    return items
      .filter((item) => item.id !== id)
      .map((item) => {
        if (item.replies) {
          return {
            ...item,
            replies: removeCommentFromList(item.replies, id),
          }
        }
        return item
      })
  }

  // Handlers
  const handleCreate = async (content: string, mentionedUsers: string[]) => {
    try {
      const response = await commentApi.create(taskId, { content, mentionedUsers })
      if (response.data) {
        setComments((prev) => [response.data, ...(prev || [])])
      }
    } catch (error) {
      console.error('Failed to create comment:', error)
    }
  }

  const handleReply = async (
    parentId: string,
    content: string,
    mentionedUsers: string[]
  ) => {
    try {
      const response = await commentApi.create(taskId, {
        content,
        parentCommentId: parentId,
        mentionedUsers,
      })
      if (response.data) {
        setComments((prev) => addReplyToComment(prev || [], parentId, response.data))
      }
    } catch (error) {
      console.error('Failed to create reply:', error)
    }
  }

  const handleEdit = async (id: string, content: string, mentionedUsers: string[]) => {
    try {
      const response = await commentApi.update(id, { content, mentionedUsers })
      if (response.data) {
        setComments((prev) => updateCommentInList(prev || [], id, response.data))
      }
    } catch (error) {
      console.error('Failed to update comment:', error)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await commentApi.remove(id)
      setComments((prev) => removeCommentFromList(prev || [], id))
    } catch (error) {
      console.error('Failed to delete comment:', error)
    }
  }

  return (
    <div className="space-y-4">
      {/* New Comment Form */}
      <div>
        <CommentEditor
          onSubmit={handleCreate}
          placeholder="Add a comment..."
          users={users}
          submitLabel="Comment"
        />
      </div>

      {/* Comments List */}
      <div className="space-y-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-slate-500">
            <Loader2 className="mr-2 size-5 animate-spin" />
            Loading comments...
          </div>
        ) : comments && comments.length > 0 ? (
          <>
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                currentUserId={currentUserId}
                users={users}
                onReply={handleReply}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
            
            {/* Infinite scroll trigger */}
            {hasMore && (
              <div ref={observerTarget} className="flex justify-center py-4">
                {isLoadingMore && (
                  <Loader2 className="size-5 animate-spin text-slate-400" />
                )}
              </div>
            )}
          </>
        ) : (
          <p className="py-8 text-center text-sm text-slate-500">
            No comments yet. Be the first to comment!
          </p>
        )}
      </div>
    </div>
  )
}
