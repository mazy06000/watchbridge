import type { H3Event } from 'h3'
import { deleteCookie, getCookie, setCookie } from 'h3'
import type { UserAccount } from '~~/core/domain/tracker'
import { normalizeEmail } from '~~/core/domain/tracker'
import { jsonError, getRequestOrigin } from './http'
import { getAuthRepository } from './tracker-repository'
import { nowIso, randomId } from './d1'

const SESSION_COOKIE = 'watchbridge_session'
const SESSION_TTL_DAYS = 30
const MAGIC_LINK_TTL_MINUTES = 15

export async function requestMagicLink(event: H3Event, email: string): Promise<{ magicLink: string, expiresAt: string }> {
  const normalizedEmail = normalizeEmail(email)
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) {
    throw jsonError(400, 'Enter a valid email address.')
  }

  const token = randomToken()
  const tokenHash = await hashSecret(event, token)
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MINUTES * 60_000).toISOString()

  await getAuthRepository(event).createMagicLink({
    id: randomId('magic'),
    email: normalizedEmail,
    tokenHash,
    expiresAt
  })

  const magicLink = `${getRequestOrigin(event)}/api/auth/magic-link/confirm?token=${encodeURIComponent(token)}`
  return { magicLink, expiresAt }
}

export async function confirmMagicLink(event: H3Event, token: string): Promise<UserAccount> {
  if (!token) {
    throw jsonError(400, 'Missing magic link token.')
  }

  const repository = getAuthRepository(event)
  const tokenHash = await hashSecret(event, token)
  const consumed = await repository.consumeMagicLink(tokenHash, nowIso())
  if (!consumed) {
    throw jsonError(401, 'Magic link expired or already used.')
  }

  const now = nowIso()
  const user = await repository.upsertUserByEmail({
    id: randomId('user'),
    email: consumed.email,
    displayName: consumed.email.split('@')[0],
    now
  })

  await createSession(event, user)
  return user
}

export async function createSession(event: H3Event, user: UserAccount): Promise<void> {
  const token = randomToken()
  const tokenHash = await hashSecret(event, token)
  const expiresAtDate = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60_000)
  const expiresAt = expiresAtDate.toISOString()
  const now = nowIso()

  await getAuthRepository(event).createSession({
    id: randomId('session'),
    userId: user.id,
    tokenHash,
    expiresAt,
    now
  })

  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: getRequestOrigin(event).startsWith('https://'),
    sameSite: 'lax',
    path: '/',
    expires: expiresAtDate
  })
}

export async function getOptionalUser(event: H3Event): Promise<UserAccount | undefined> {
  const token = getCookie(event, SESSION_COOKIE)
  if (!token) {
    return undefined
  }

  const tokenHash = await hashSecret(event, token)
  return getAuthRepository(event).findUserBySessionHash(tokenHash, nowIso())
}

export async function requireUser(event: H3Event): Promise<UserAccount> {
  const user = await getOptionalUser(event)
  if (!user) {
    throw jsonError(401, 'Sign in to use SagaLog.')
  }
  return user
}

export async function logout(event: H3Event): Promise<void> {
  const token = getCookie(event, SESSION_COOKIE)
  if (token) {
    await getAuthRepository(event).deleteSession(await hashSecret(event, token))
  }

  deleteCookie(event, SESSION_COOKIE, { path: '/' })
}

export async function hashSecret(event: H3Event, value: string): Promise<string> {
  const config = useRuntimeConfig(event)
  const secret = String(config.authSecret || config.oauthStateSecret || 'watchbridge-dev-secret')
  const data = new TextEncoder().encode(`${secret}:${value}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function randomToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}
