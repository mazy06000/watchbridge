import { describe, expect, it } from 'vitest'
import { mapBetaSeriesOperationRequest } from '~~/server/utils/betaseries-provider'

describe('BetaSeries provider operation mapping', () => {
  it('marks individual episodes without bulk backfilling previous episodes', () => {
    expect(mapBetaSeriesOperationRequest({
      operationId: 'episode-1',
      kind: 'episode-watched',
      providerId: '100'
    })).toEqual({
      method: 'POST',
      path: '/episodes/watched',
      body: {
        id: '100',
        bulk: 'false'
      }
    })
  })

  it('maps watched movies to seen and list rows to to-see', () => {
    expect(mapBetaSeriesOperationRequest({
      operationId: 'movie-1',
      kind: 'movie-watched',
      providerId: '200',
      state: 'watched'
    }).body).toEqual({
      id: '200',
      state: '1'
    })

    expect(mapBetaSeriesOperationRequest({
      operationId: 'movie-2',
      kind: 'movie-list',
      providerId: '201',
      state: 'followed'
    }).body).toEqual({
      id: '201',
      state: '0'
    })
  })
})
