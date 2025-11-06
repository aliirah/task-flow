import { toast } from 'sonner'
import { ApiError, ValidationError } from '@/lib/types/api'
import {
  FieldValues,
  Path,
  UseFormClearErrors,
  UseFormSetError,
} from 'react-hook-form'

type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'CORS_ERROR'
  | 'NOT_FOUND'
  | 'SERVER_ERROR'
  | 'PARSE_ERROR'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_ALREADY_EXISTS'
  | 'UNKNOWN_ERROR'

interface ErrorHandlerOptions<TFieldValues extends FieldValues> {
  error: unknown
  setError?: UseFormSetError<TFieldValues>
  clearErrors?: UseFormClearErrors<TFieldValues>
  fields?: Path<TFieldValues>[]
}

const MESSAGES: Record<
  ErrorCode,
  { title: string; description: string }
> = {
  VALIDATION_ERROR: {
    title: 'Validation Error',
    description: 'Please correct the highlighted fields and try again.',
  },
  NETWORK_ERROR: {
    title: 'Connection Error',
    description: 'Unable to reach the server. Check your connection and retry.',
  },
  CORS_ERROR: {
    title: 'Connection Error',
    description: 'We could not connect to the server. Please try again shortly.',
  },
  NOT_FOUND: {
    title: 'Service Unavailable',
    description: 'The requested service is unavailable right now. Try again later.',
  },
  SERVER_ERROR: {
    title: 'Server Error',
    description: 'Something went wrong on our side. Please try again later.',
  },
  PARSE_ERROR: {
    title: 'System Error',
    description: 'We ran into a problem processing the response.',
  },
  INVALID_CREDENTIALS: {
    title: 'Invalid Credentials',
    description: 'Check your email and password and try again.',
  },
  EMAIL_ALREADY_EXISTS: {
    title: 'Account Exists',
    description: 'That email is already registered. Try signing in instead.',
  },
  UNKNOWN_ERROR: {
    title: 'Unexpected Error',
    description: 'Something went wrong. Please try again later.',
  },
}

function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error
  }

  // Axios-style error
  const maybeAxios = error as {
    response?: { data?: unknown }
    message?: string
  }
  if (maybeAxios?.response?.data) {
    return ApiError.fromResponse(maybeAxios.response.data)
  }

  // Fetch Response
  if (error instanceof Response) {
    return new ApiError(
      error.status === 404 ? 'NOT_FOUND' : 'NETWORK_ERROR',
      `Request failed with status ${error.status}`
    )
  }

  return new ApiError(
    'UNKNOWN_ERROR',
    (error as Error)?.message ?? 'An unexpected error occurred'
  )
}

function applyValidationErrors<TFieldValues extends FieldValues>(
  setError: UseFormSetError<TFieldValues> | undefined,
  validationErrors?: ValidationError[]
) {
  if (!setError || !validationErrors?.length) {
    return
  }

  validationErrors.forEach(({ field, message }) => {
    setError(field as Path<TFieldValues>, {
      type: 'server',
      message,
    })
  })
}

export function handleApiError<TFieldValues extends FieldValues>({
  error,
  setError,
  clearErrors,
  fields,
}: ErrorHandlerOptions<TFieldValues>) {
  console.error('API error:', error)

  if (clearErrors && fields?.length) {
    clearErrors(fields)
  }

  const apiError = normalizeError(error)

  switch (apiError.code as ErrorCode) {
    case 'VALIDATION_ERROR':
      applyValidationErrors(setError, apiError.validationErrors)
      toast.error(MESSAGES.VALIDATION_ERROR.title, {
        description: MESSAGES.VALIDATION_ERROR.description,
      })
      break

    case 'INVALID_CREDENTIALS':
      if (setError) {
        setError('password' as Path<TFieldValues>, {
          type: 'server',
          message: 'Invalid email or password',
        })
      }
      toast.error(MESSAGES.INVALID_CREDENTIALS.title, {
        description: MESSAGES.INVALID_CREDENTIALS.description,
      })
      break

    case 'EMAIL_ALREADY_EXISTS':
      if (setError) {
        setError('email' as Path<TFieldValues>, {
          type: 'server',
          message: 'This email is already registered',
        })
      }
      toast.error(MESSAGES.EMAIL_ALREADY_EXISTS.title, {
        description: MESSAGES.EMAIL_ALREADY_EXISTS.description,
      })
      break

    default: {
      const fallback = MESSAGES[apiError.code as ErrorCode] ?? MESSAGES.UNKNOWN_ERROR
      const description =
        apiError.message !== fallback.description ? apiError.message : fallback.description

      toast.error(fallback.title, { description })
    }
  }
}
