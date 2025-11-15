import type { TaskPriority, TaskStatus } from '@/lib/types/api'

export type TaskEventType = 'task.event.created' | 'task.event.updated'

export interface TaskEventUser {
  id?: string
  email?: string
  firstName?: string
  lastName?: string
}

interface TaskEventBase {
  taskId: string
  organizationId: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  reporterId: string
  assigneeId?: string
  reporter?: TaskEventUser
  assignee?: TaskEventUser
  triggeredById?: string
  triggeredBy?: TaskEventUser
  dueAt?: string
}

export interface TaskCreatedEventPayload extends TaskEventBase {
  createdAt?: string
  updatedAt?: string
}

export interface TaskUpdatedEventPayload extends TaskEventBase {
  updatedAt?: string
}

export type TaskEventPayload = TaskCreatedEventPayload | TaskUpdatedEventPayload

export type TaskEventMessage =
  | { type: 'task.event.created'; data: TaskCreatedEventPayload }
  | { type: 'task.event.updated'; data: TaskUpdatedEventPayload }

// Comment event types
export type CommentEventType = 'comment.event.created' | 'comment.event.updated' | 'comment.event.deleted'

export interface CommentEventUser {
  id?: string
  email?: string
  firstName?: string
  lastName?: string
}

interface CommentEventBase {
  commentId: string
  taskId: string
  organizationId: string
  userId: string
  content: string
  mentionedUsers?: string[]
  user?: CommentEventUser
}

export interface CommentCreatedEventPayload extends CommentEventBase {
  createdAt?: string
  updatedAt?: string
}

export interface CommentUpdatedEventPayload extends CommentEventBase {
  updatedAt?: string
}

export interface CommentDeletedEventPayload extends CommentEventBase {
  deletedAt?: string
}

export type CommentEventPayload = CommentCreatedEventPayload | CommentUpdatedEventPayload | CommentDeletedEventPayload

export type CommentEventMessage =
  | { type: 'comment.event.created'; data: CommentCreatedEventPayload }
  | { type: 'comment.event.updated'; data: CommentUpdatedEventPayload }
  | { type: 'comment.event.deleted'; data: CommentDeletedEventPayload }

// Notification types
export interface NotificationPayload {
  id: string
  type: string
  title: string
  message: string
  url: string
  userId: string
  isRead: boolean
  createdAt: string
}

export type NotificationMessage = {
  type: 'notification.created'
  data: NotificationPayload
}
