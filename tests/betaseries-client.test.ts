import { describe, expect, it } from 'vitest'
import { parseBetaSeriesResponse } from '~~/server/utils/betaseries-client'

describe('BetaSeries client response parsing', () => {
  it('accepts OAuth token form responses', () => {
    expect(parseBetaSeriesResponse('access_token=abc123')).toEqual({
      access_token: 'abc123'
    })
  })

  it('accepts JSON API responses', () => {
    expect(parseBetaSeriesResponse('{"shows":[{"id":1,"title":"Example"}],"errors":[]}')).toEqual({
      shows: [{ id: 1, title: 'Example' }],
      errors: []
    })
  })
})
