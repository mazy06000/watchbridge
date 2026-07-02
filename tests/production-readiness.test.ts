import { describe, expect, it } from 'vitest'
import { missingConfigKeys } from '~~/server/utils/http'
import { securityHeaders } from '~~/server/utils/security-headers'

describe('production readiness utilities', () => {
  it('reports missing config keys without exposing values', () => {
    expect(missingConfigKeys({
      NUXT_BETASERIES_API_KEY: 'present',
      NUXT_BETASERIES_CLIENT_SECRET: '',
      NUXT_OAUTH_STATE_SECRET: undefined
    })).toEqual([
      'NUXT_BETASERIES_CLIENT_SECRET',
      'NUXT_OAUTH_STATE_SECRET'
    ])
  })

  it('sets browser hardening headers', () => {
    expect(securityHeaders()).toMatchObject({
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'strict-origin-when-cross-origin'
    })
  })
})
