import type { H3Event } from 'h3'
import { jsonError } from './http'

interface BetaSeriesRequest {
  method: 'GET' | 'POST' | 'DELETE'
  path: string
  query?: Record<string, number | string | undefined>
  body?: Record<string, number | string | undefined>
  accessToken?: string
}

interface BetaSeriesConfig {
  apiKey: string
  clientSecret: string
  version: string
}

const API_BASE = 'https://api.betaseries.com'

export function getBetaSeriesConfig(event: H3Event): BetaSeriesConfig {
  const config = useRuntimeConfig(event)
  const apiKey = String(config.betaseriesApiKey || '')
  const clientSecret = String(config.betaseriesClientSecret || '')
  const version = String(config.public.betaSeriesApiVersion || '3.0')

  if (!apiKey) {
    throw jsonError(500, 'BetaSeries API key is not configured.')
  }

  return { apiKey, clientSecret, version }
}

export async function betaSeriesRequest<T = unknown>(
  event: H3Event,
  request: BetaSeriesRequest
): Promise<T> {
  const { apiKey, version } = getBetaSeriesConfig(event)
  const url = new URL(request.path, API_BASE)

  for (const [key, value] of Object.entries(request.query ?? {})) {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, String(value))
    }
  }

  const headers = new Headers({
    accept: 'application/json',
    'user-agent': 'SagaLog/1.0 (+https://watchbridge.org)',
    'x-betaseries-key': apiKey,
    'x-betaseries-version': version
  })

  if (request.accessToken) {
    headers.set('authorization', `Bearer ${request.accessToken}`)
  }

  let body: URLSearchParams | undefined
  if (request.method !== 'GET' && request.body) {
    headers.set('content-type', 'application/x-www-form-urlencoded')
    body = new URLSearchParams()
    for (const [key, value] of Object.entries(request.body)) {
      if (value !== undefined && value !== '') {
        body.set(key, String(value))
      }
    }
  }

  const response = await fetch(url, {
    method: request.method,
    headers,
    body
  })

  const text = await response.text()
  const parsed = parseBetaSeriesResponse(text)

  if (!response.ok || hasApiErrors(parsed)) {
    throw jsonError(response.status || 502, extractApiError(parsed) || 'BetaSeries request failed.')
  }

  return parsed as T
}

export async function exchangeBetaSeriesCode(
  event: H3Event,
  input: {
    code: string
    redirectUri: string
  }
): Promise<string> {
  const { apiKey, clientSecret, version } = getBetaSeriesConfig(event)

  if (!clientSecret) {
    throw jsonError(500, 'BetaSeries client secret is not configured.')
  }

  const body = new URLSearchParams({
    client_id: apiKey,
    client_secret: clientSecret,
    redirect_uri: input.redirectUri,
    code: input.code
  })

  const response = await fetch(`${API_BASE}/oauth/access_token`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
      'x-betaseries-key': apiKey,
      'x-betaseries-version': version
    },
    body
  })

  const text = await response.text()
  const parsed = parseBetaSeriesResponse(text)

  if (!response.ok || hasApiErrors(parsed)) {
    throw jsonError(response.status || 502, extractApiError(parsed) || 'BetaSeries OAuth exchange failed.')
  }

  const token = typeof parsed === 'object' && parsed !== null
    ? (parsed as Record<string, unknown>).access_token
    : undefined

  if (typeof token !== 'string' || token.length === 0) {
    throw jsonError(502, 'BetaSeries did not return an access token.')
  }

  return token
}

export function parseBetaSeriesResponse(text: string): unknown {
  const trimmed = text.trim()
  if (!trimmed) {
    return {}
  }

  if (trimmed.startsWith('access_token=')) {
    return Object.fromEntries(new URLSearchParams(trimmed))
  }

  try {
    return JSON.parse(trimmed)
  } catch {
    return { raw: trimmed }
  }
}

function hasApiErrors(parsed: unknown): boolean {
  if (!parsed || typeof parsed !== 'object') {
    return false
  }

  const errors = (parsed as Record<string, unknown>).errors
  return Array.isArray(errors) && errors.length > 0
}

function extractApiError(parsed: unknown): string | undefined {
  if (!parsed || typeof parsed !== 'object') {
    return undefined
  }

  const errors = (parsed as Record<string, unknown>).errors
  if (!Array.isArray(errors) || errors.length === 0) {
    return undefined
  }

  const first = errors[0]
  if (typeof first === 'string') {
    return first
  }

  if (first && typeof first === 'object') {
    const candidate = first as Record<string, unknown>
    return String(candidate.text || candidate.message || candidate.code || 'BetaSeries API error')
  }

  return 'BetaSeries API error'
}
