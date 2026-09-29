import type { ApiErrorResponse } from './contracts'

const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''
let tokenReader: () => string | null = () => null
let unauthorizedHandler: ((token: string) => void) | undefined

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors: ApiErrorResponse['fieldErrors'] = [],
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function configureAuth(reader: () => string | null, onUnauthorized: (token: string) => void) {
  tokenReader = reader
  unauthorizedHandler = onUnauthorized
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  auth?: boolean
  body?: unknown
  query?: Record<string, string | number | boolean | null | undefined>
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(`${configuredBaseUrl}${path}`, window.location.origin)
  Object.entries(options.query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
  })
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (options.body !== undefined) headers.set('Content-Type', 'application/json')

  const requestToken = options.auth ? tokenReader() : null
  if (options.auth) {
    if (!requestToken) throw new ApiError(401, 'AUTH_REQUIRED', 'Vui lòng đăng nhập để tiếp tục.')
    headers.set('Authorization', `Bearer ${requestToken}`)
  } else {
    headers.delete('Authorization')
  }

  let response: Response
  try {
    response = await fetch(url, {
      ...options,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Không thể kết nối máy chủ. Vui lòng thử lại.')
  }

  if (!response.ok) {
    let payload: Partial<ApiErrorResponse> = {}
    try { payload = await response.json() as ApiErrorResponse } catch { /* empty/non-JSON response */ }
    if (response.status === 401 && requestToken) unauthorizedHandler?.(requestToken)
    const fallback = response.status === 403
      ? 'Bạn không có quyền thực hiện thao tác này.'
      : 'Yêu cầu chưa thể hoàn tất. Vui lòng thử lại.'
    throw new ApiError(response.status, payload.code ?? 'HTTP_ERROR', payload.message ?? fallback, payload.fieldErrors ?? [])
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export async function apiDownload(path: string): Promise<Blob> {
  const response = await authenticatedBinaryRequest(path, { method: 'GET' })
  return response.blob()
}

export async function apiUpload<T>(path: string, file: File): Promise<T> {
  const body = new FormData()
  body.append('file', file)
  const response = await authenticatedBinaryRequest(path, { method: 'POST', body })
  return response.json() as Promise<T>
}

async function authenticatedBinaryRequest(path: string, init: RequestInit): Promise<Response> {
  const token = tokenReader()
  if (!token) throw new ApiError(401, 'AUTH_REQUIRED', 'Vui lòng đăng nhập để tiếp tục.')
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  headers.set('Accept', 'application/json, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  let response: Response
  try {
    response = await fetch(new URL(`${configuredBaseUrl}${path}`, window.location.origin), { ...init, headers })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Không thể kết nối máy chủ. Vui lòng thử lại.')
  }
  if (!response.ok) {
    let payload: Partial<ApiErrorResponse> = {}
    try { payload = await response.json() as ApiErrorResponse } catch { /* empty/non-JSON response */ }
    if (response.status === 401) unauthorizedHandler?.(token)
    const fallback = response.status === 403 ? 'Bạn không có quyền thực hiện thao tác này.' : 'Yêu cầu chưa thể hoàn tất. Vui lòng thử lại.'
    throw new ApiError(response.status, payload.code ?? 'HTTP_ERROR', payload.message ?? fallback, payload.fieldErrors ?? [])
  }
  return response
}
