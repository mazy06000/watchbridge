import type { H3Event } from 'h3'

export function setNoStoreHeaders(event: H3Event): void {
  setHeader(event, 'cache-control', 'no-store, max-age=0')
  setHeader(event, 'pragma', 'no-cache')
  setHeader(event, 'expires', '0')
}

export function getRequestOrigin(event: H3Event): string {
  const config = useRuntimeConfig(event)
  if (config.public.appBaseUrl) {
    return String(config.public.appBaseUrl).replace(/\/$/, '')
  }

  const url = getRequestURL(event)
  return `${url.protocol}//${url.host}`
}

export function jsonError(statusCode: number, message: string) {
  return createError({
    statusCode,
    statusMessage: message,
    message
  })
}

export function missingConfigKeys(config: Record<string, unknown>): string[] {
  return Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key)
}
