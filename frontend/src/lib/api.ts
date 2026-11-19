/** Error thrown for any non-2xx API response. `code` is set when the server sends a structured error. */
export class ApiError extends Error {
  status: number
  code?: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

interface FastApiValidationIssue {
  loc: (string | number)[]
  msg: string
}

function messageFrom(detail: unknown, fallback: string): { message: string; code?: string } {
  if (typeof detail === 'string') return { message: detail }
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as FastApiValidationIssue
    return { message: first.msg.replace(/^Value error, /, '') }
  }
  if (detail && typeof detail === 'object' && 'message' in detail) {
    const d = detail as { message: string; code?: string }
    return { message: d.message, code: d.code }
  }
  return { message: fallback }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      credentials: 'same-origin',
      ...rest,
      headers: json !== undefined ? { 'Content-Type': 'application/json', ...headers } : headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    })
  } catch {
    throw new ApiError(0, 'Could not reach the FluentDay server. Check your connection and try again.')
  }
  if (response.status === 204) return undefined as T
  const body = await response.json().catch(() => null)
  if (body === null && [502, 503, 504].includes(response.status)) {
    // The dev server's proxy answers 502 when the backend isn't running.
    throw new ApiError(response.status, 'The FluentDay server isn’t responding. If you’re running it yourself, start the backend and try again.')
  }
  if (!response.ok) {
    const { message, code } = messageFrom(body?.detail, `Something went wrong (${response.status}).`)
    throw new ApiError(response.status, message, code)
  }
  return body as T
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.'
}
