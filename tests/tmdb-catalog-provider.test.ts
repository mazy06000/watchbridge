import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTmdbCatalogProvider } from '~~/server/utils/tmdb-catalog-provider'

describe('TMDB catalog provider', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('normalizes movie detail responses with upcoming release dates', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      id: 987654,
      imdb_id: 'tt9999999',
      title: 'Future Film',
      original_title: 'Future Film',
      poster_path: '/future.jpg',
      release_date: '2099-04-12',
      runtime: 142,
      overview: 'A movie that has not released yet.',
      vote_average: 7.8,
      vote_count: 1200,
      genres: [{ id: 18, name: 'Drama' }],
      status: 'Post Production'
    }), { status: 200, headers: { 'content-type': 'application/json' } })))

    const title = await createTmdbCatalogProvider({ accessToken: 'token' }).getTitle('tmdb-movie-987654')

    expect(title).toMatchObject({
      id: 'tmdb-movie-987654',
      imdbId: 'tt9999999',
      type: 'movie',
      primaryTitle: 'Future Film',
      primaryImageUrl: 'https://image.tmdb.org/t/p/w500/future.jpg',
      startYear: 2099,
      runtimeSeconds: 8520,
      genres: ['Drama'],
      nextRelease: {
        kind: 'movie',
        title: 'Theatrical release',
        date: '2099-04-12',
        source: 'tmdb'
      }
    })
  })

  it('searches TV results and normalizes them as series titles', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toContain('/search/tv')
      return new Response(JSON.stringify({
        results: [
          {
            id: 1396,
            name: 'Breaking Bad',
            original_name: 'Breaking Bad',
            first_air_date: '2008-01-20',
            overview: 'A chemistry teacher changes.',
            vote_average: 8.9,
            vote_count: 16000
          }
        ]
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    const results = await createTmdbCatalogProvider({ accessToken: 'token' }).search({ query: 'breaking', type: 'series', limit: 5 })

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      id: 'tmdb-tv-1396',
      type: 'series',
      primaryTitle: 'Breaking Bad',
      startYear: 2008
    })
  })

  it('uses TVMaze as a next episode fallback when TMDB has no next episode', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const target = String(url)
      if (target.includes('api.themoviedb.org/3/tv/1396')) {
        return new Response(JSON.stringify({
          id: 1396,
          name: 'Breaking Bad',
          first_air_date: '2008-01-20',
          overview: 'A chemistry teacher changes.',
          vote_average: 8.9,
          vote_count: 16000,
          genres: [{ id: 80, name: 'Crime' }],
          external_ids: {
            imdb_id: 'tt0903747',
            tvdb_id: 81189
          },
          next_episode_to_air: null
        }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      if (target.includes('api.tvmaze.com/lookup/shows')) {
        return new Response(JSON.stringify({ id: 169 }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      if (target.includes('api.tvmaze.com/shows/169')) {
        return new Response(JSON.stringify({
          id: 169,
          _embedded: {
            nextepisode: {
              name: 'Pilot',
              season: 1,
              number: 1,
              airdate: '2099-01-20'
            }
          }
        }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response('Not found', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const title = await createTmdbCatalogProvider({ accessToken: 'token' }).getTitle('tmdb-tv-1396')

    expect(title).toMatchObject({
      id: 'tmdb-tv-1396',
      type: 'series',
      primaryTitle: 'Breaking Bad',
      imdbId: 'tt0903747',
      nextRelease: {
        kind: 'episode',
        title: 'Pilot',
        date: '2099-01-20',
        seasonNumber: 1,
        episodeNumber: 1,
        source: 'tvmaze'
      }
    })
  })
})
