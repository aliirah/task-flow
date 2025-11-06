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

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public validationErrors?: ValidationError[]
  ) {
    super(message)
    this.name = 'ApiError'
  }

  static fromResponse(data: any): ApiError {
    if (data.error?.code === 'VALIDATION_ERROR' && Array.isArray(data.error.details)) {
      return new ApiError(
        'VALIDATION_ERROR',
        'Validation failed',
        data.error.details.map((detail: any) => ({
          field: detail.field,
          message: detail.message
        }))
      )
    }

    return new ApiError(
      data.error?.code || 'UNKNOWN_ERROR',
      data.error?.message || 'An unexpected error occurred'
    )
  }
}