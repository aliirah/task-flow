export interface ValidationError {
  field: string
  message: string
}

export interface ApiResponse<T> {
  requestId: string
  status: 'success' | 'error'
  data: T
  error?: {
    code: string
    message: string
    details?: ValidationError[]
  }
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  expiresAt: string
  user: User
}

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  roles: string[]
  status: string
  userType: string
}

export interface RegisterData {
  email: string
  password: string
  firstName: string
  lastName: string
}

type ApiErrorPayload = {
  error?: {
    code?: string
    message?: string
    details?: unknown
  }
}

function isValidationErrorPayload(value: unknown): value is ValidationError {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Record<string, unknown>
  return typeof candidate.field === 'string' && typeof candidate.message === 'string'
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public validationErrors?: ValidationError[]
  ) {
    super(message)
    this.name = 'ApiError'
  }

  static fromResponse(data: unknown): ApiError {
    const payload = (data ?? {}) as ApiErrorPayload
    const { error } = payload

    if (
      error?.code === 'VALIDATION_ERROR' &&
      Array.isArray(error.details)
    ) {
      const details = error.details
        .filter(isValidationErrorPayload)
        .map((detail) => ({
          field: detail.field,
          message: detail.message,
        }))
      return new ApiError(
        'VALIDATION_ERROR',
        'Validation failed',
        details
      )
    }

    return new ApiError(
      error?.code ?? 'UNKNOWN_ERROR',
      error?.message ?? 'An unexpected error occurred'
    )
  }
}

export type Organization = {
  id: string
  name: string
  description?: string
  ownerId: string
  createdAt?: string
  updatedAt?: string
}

export type OrganizationMember = {
  id: string
  organizationId: string
  userId: string
  role: 'owner' | 'admin' | 'member'
  status: string
  createdAt?: string
  user?: User
  organization?: Organization
}

export type TaskStatus = 'open' | 'in_progress' | 'completed' | 'blocked' | 'cancelled'
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'
export type TaskType = 'task' | 'story' | 'sub-task'

export type Task = {
  id: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  type: TaskType
  organizationId: string
  assigneeId?: string
  reporterId?: string
  parentTaskId?: string
  displayOrder: number
  dueAt?: string
  createdAt?: string
  updatedAt?: string
  organization?: Organization
  assignee?: User
  reporter?: User
  subTasks?: Task[]
}

export interface TaskListResponse {
  items: Task[]
  page: number
  limit: number
  hasMore: boolean
}

export type Comment = {
  id: string
  taskId: string
  userId: string
  parentCommentId?: string
  content: string
  mentionedUsers?: string[]
  createdAt: string
  updatedAt: string
  user?: User
  replies?: Comment[]
}

export interface CommentListResponse {
  items: Comment[]
  page: number
  limit: number
  hasMore: boolean
}

export type Notification = {
  id: string
  type: string
  title: string
  message: string
  url: string
  userId: string
  isRead: boolean
  createdAt: string
  entityType?: string
  entityId?: string
}

export interface NotificationListResponse {
  items: Notification[]
  total: number
  hasMore: boolean
}

export interface UnreadCountResponse {
  count: number
}

export type SearchResultType = 'task' | 'comment' | 'user'

export interface SearchResult {
  id: string
  type: SearchResultType
  title: string
  summary?: string
  content?: string
  organizationId?: string
  taskId?: string
  userId?: string
  email?: string
  score?: number
  metadata?: Record<string, string>
}

export interface SearchResponse {
  total: number
  results: SearchResult[]
}

export interface SearchSuggestResponse {
  results: string[]
}
