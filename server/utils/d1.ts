import type { H3Event } from 'h3'

interface CloudflareContext {
  env?: {
    DB?: D1Database
  }
}

export function getD1Database(event: H3Event): D1Database | undefined {
  const shouldUseD1 = process.env.NODE_ENV === 'production' || process.env.WATCHBRIDGE_USE_D1_DEV === '1'
  if (!shouldUseD1) {
    return undefined
  }

  const context = event.context as typeof event.context & {
    cloudflare?: CloudflareContext
  }

  return context.cloudflare?.env?.DB
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`
}

export function encodeJson(value: unknown): string {
  return JSON.stringify(value ?? null)
}

export function parseJsonArray(value: unknown): string[] {
  if (typeof value !== 'string' || value.trim() === '') {
    return []
  }

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}
