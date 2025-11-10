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
