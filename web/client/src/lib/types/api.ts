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
