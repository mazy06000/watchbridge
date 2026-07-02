import { jsonError } from './http'

interface OAuthStatePayload {
  provider: 'betaseries'
  origin: string
  nonce: string
  iat: number
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const MAX_STATE_AGE_MS = 10 * 60 * 1000

export async function createOAuthState(payload: Omit<OAuthStatePayload, 'iat' | 'nonce'>, secret: string): Promise<string> {
  assertSecret(secret)

  const fullPayload: OAuthStatePayload = {
    ...payload,
    nonce: crypto.randomUUID(),
    iat: Date.now()
  }

  const encodedPayload = base64UrlEncode(encoder.encode(JSON.stringify(fullPayload)))
  const signature = await sign(encodedPayload, secret)
  return `${encodedPayload}.${signature}`
}

export async function verifyOAuthState(state: string, secret: string): Promise<OAuthStatePayload> {
  assertSecret(secret)

  const [encodedPayload, signature] = state.split('.')
  if (!encodedPayload || !signature) {
    throw jsonError(400, 'Invalid OAuth state.')
  }

  const expected = await sign(encodedPayload, secret)
  if (!constantTimeEqual(signature, expected)) {
    throw jsonError(400, 'Invalid OAuth state signature.')
  }

  const payload = JSON.parse(decoder.decode(base64UrlDecode(encodedPayload))) as OAuthStatePayload
  if (payload.provider !== 'betaseries' || !payload.origin || !payload.iat) {
    throw jsonError(400, 'Invalid OAuth state payload.')
  }

  if (Date.now() - payload.iat > MAX_STATE_AGE_MS) {
    throw jsonError(400, 'OAuth state expired.')
  }

  return payload
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value))
  return base64UrlEncode(new Uint8Array(signature))
}

function assertSecret(secret: string): void {
  if (secret.length < 24) {
    throw jsonError(500, 'OAuth state secret is missing or too short.')
  }
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let diff = 0
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }
  return diff === 0
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]!)
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}
