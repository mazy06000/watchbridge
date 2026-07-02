import type { H3Event } from 'h3'
import { deleteCookie, getCookie, setCookie } from 'h3'

const OAUTH_STATE_COOKIE = 'watchbridge_oauth_state'
const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60
const OAUTH_COOKIE_PATH = '/api/providers/betaseries'

export function setOAuthStateCookie(event: H3Event, state: string): void {
  setCookie(event, OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
    path: OAUTH_COOKIE_PATH,
    sameSite: 'lax',
    secure: getRequestOrigin(event).startsWith('https://')
  })
}

export function readOAuthStateCookie(event: H3Event): string {
  return getCookie(event, OAUTH_STATE_COOKIE) ?? ''
}

export function clearOAuthStateCookie(event: H3Event): void {
  deleteCookie(event, OAUTH_STATE_COOKIE, {
    path: OAUTH_COOKIE_PATH
  })
}
