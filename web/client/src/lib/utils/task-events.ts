import type { Task, User } from '@/lib/types/api'
import type {
  TaskEventMessage,
  TaskEventPayload,
  TaskEventUser,
} from '@/lib/types/ws'

const SUMMARY_LIMIT = 100

const toUser = (payload?: TaskEventUser): User | undefined => {
  if (!payload?.id) {
    return undefined
  }
  return {
    id: payload.id,
    email: payload.email ?? '',
    firstName: payload.firstName ?? '',
    lastName: payload.lastName ?? '',
    roles: [],
    status: '',
    userType: '',
  }
}

export const formatTaskEventActor = (payload: TaskEventPayload): string => {
  const actor =
    payload.triggeredBy ?? payload.reporter ?? payload.assignee ?? null
  if (!actor) {
    return 'Someone'
  }
  const fullName = `${actor.firstName ?? ''} ${actor.lastName ?? ''}`
    .trim()
    .replace(/\s+/g, ' ')
  if (fullName) {
    return fullName
  }
  if (actor.email) {
    return actor.email
  }
  return 'Someone'
}

const sentenceCase = (value?: string) => {
  if (!value) return ''
  return value
    .replace(/_/g, ' ')
    .replace(/\w\S*/g, (word) => word[0]?.toUpperCase() + word.slice(1))
}

export const describeTaskEvent = (event: TaskEventMessage) => {
  const { data } = event
  const actor = formatTaskEventActor(data)
  const action = event.type === 'task.event.created' ? 'created' : 'updated'
  const title = data.title || 'task'
  const toastTitle = `${actor} ${action} "${title}"`

  const details: string[] = []
  if (data.status) {
    details.push(`Status: ${sentenceCase(data.status)}`)
  }
  if (data.priority) {
    details.push(`Priority: ${sentenceCase(data.priority)}`)
  }
  if (data.assignee) {
    const assigneeName =
      `${data.assignee.firstName ?? ''} ${data.assignee.lastName ?? ''}`
        .trim()
        .replace(/\s+/g, ' ') ||
      data.assignee.email ||
      data.assignee.id
    if (assigneeName) {
      details.push(`Assignee: ${assigneeName}`)
    }
  }

  return {
    title: toastTitle,
    description: details.length ? details.join(' • ') : undefined,
  }
}

export const taskEventToTask = (event: TaskEventMessage): Task => {
  const { data } = event
  const createdAt =
    event.type === 'task.event.created'
      ? data.createdAt ?? data.updatedAt
      : data.createdAt
  const updatedAt = data.updatedAt ?? data.createdAt

  return {
    id: data.taskId,
    title: data.title,
    description: data.description,
    status: data.status,
    priority: data.priority,
    organizationId: data.organizationId,
    assigneeId: data.assigneeId || undefined,
    reporterId: data.reporterId || undefined,
    dueAt: data.dueAt,
    createdAt: createdAt ?? undefined,
    updatedAt: updatedAt ?? undefined,
    assignee: toUser(data.assignee),
    reporter: toUser(data.reporter),
  }
}

export const upsertTaskWithLimit = (
  list: Task[],
  incoming: Task,
  limit = SUMMARY_LIMIT
) => {
  const index = list.findIndex((task) => task.id === incoming.id)
  if (index >= 0) {
    const next = list.slice()
    next[index] = { ...next[index], ...incoming }
    return next
  }
  return [incoming, ...list].slice(0, limit)
}
