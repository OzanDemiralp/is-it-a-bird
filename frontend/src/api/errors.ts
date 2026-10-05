/** Error codes the backend can return (backend/app/core/errors.py) plus two client-side ones. */
export type ApiErrorCode =
  | 'OPENSKY_RATE_LIMITED'
  | 'OPENSKY_TIMEOUT'
  | 'OPENSKY_UNREACHABLE'
  | 'OPENSKY_BAD_RESPONSE'
  | 'OPENSKY_INVALID_DATA'
  | 'OPENSKY_AUTH_FAILED'
  | 'REQUEST_VALIDATION_FAILED'
  | 'RESOURCE_NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'INTERNAL_ERROR'
  /** The backend could not be reached at all (it is down, or the proxy failed). */
  | 'NETWORK_ERROR'
  /** The backend answered with something that is not the documented error shape. */
  | 'UNKNOWN_ERROR'

/** Flat error body returned by the backend's global handler. */
export interface ApiErrorBody {
  code: string
  name: string
  message: string
  details?: unknown
}

export class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorCode
  readonly errorName: string
  readonly details: unknown

  // Explicit fields instead of constructor parameter properties (erasableSyntaxOnly).
  constructor(
    status: number,
    code: ApiErrorCode,
    errorName: string,
    message: string,
    details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.errorName = errorName
    this.details = details
  }
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.code === 'string' && typeof v.name === 'string' && typeof v.message === 'string'
}

/** Builds an ApiError from a failed HTTP response, tolerating bodies that are not our shape. */
export async function apiErrorFromResponse(response: Response): Promise<ApiError> {
  let body: unknown
  try {
    body = await response.json()
  } catch {
    body = undefined
  }
  if (isErrorBody(body)) {
    return new ApiError(response.status, body.code as ApiErrorCode, body.name, body.message, body.details)
  }
  return new ApiError(
    response.status,
    'UNKNOWN_ERROR',
    'UnknownError',
    `Unexpected response from server (HTTP ${response.status})`,
  )
}
