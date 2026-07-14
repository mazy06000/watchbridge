import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { buildTransferPlan } from '~~/core/application/build-transfer-plan'
import { parseTvTimeCsvEntries, parseTvTimeJsonEntries, readTvTimeGdprZip } from '~~/infra/sources/tvtime-gdpr-reader'

const episodeTracking = `updated_at,series_follow_count,created_at,total_series_runtime,user_id,key,ep_watch_count,total_movies_runtime,movie_watch_count,series_name,s_id,is_followed,most_recent_ep_watched,is_for_later,is_archived,uuid,followed_at,episode_id,episode_number,is_unitary,s_no,bulk_type,runtime,season_number,ep_id,ep_no,gsi,is_special
2026-01-02T10:00:00Z,,2026-01-01T10:00:00Z,,u,key-1,,,,Example Show,show-1,true,,false,false,,2026-01-01T09:00:00Z,ep-1,1,,1,season,42,1,ep-1,1,,false
2026-01-03T10:00:00Z,,2026-01-03T10:00:00Z,,u,key-2,,,,Example Show,show-1,true,,false,false,,2026-01-01T09:00:00Z,ep-2,2,,1,season,42,1,ep-2,2,,false
2026-01-04T10:00:00Z,,2026-01-04T10:00:00Z,,u,key-3,,,,Special Show,show-2,true,,false,false,,2026-01-04T09:00:00Z,ep-special,1,,0,season,48,0,ep-special,1,,true
2026-01-05T10:00:00Z,,2026-01-05T10:00:00Z,,u,key-show,,,,Example Show,show-1,true,,false,false,,2026-01-01T09:00:00Z,,,,,,,,,
`

const showData = `tv_show_name,user_id,tv_show_id,is_followed,is_favorited,nb_episodes_seen
Example Show,u,show-1,true,true,2
Special Show,u,show-2,true,false,1
`

const movieTracking = `watches,user_id,type-uuid-n,watch_count,uuid,release_date,follow_date_range_key,entity_type,alpha_range_key,type,updated_at,runtime,release_date_range_key,created_at,movie_name,rewatch_count,total_movies_runtime,watch_date_range_key,country
,u,row-1,,movie-1,2024-05-01,,movie,,watch,2026-02-02T10:00:00Z,120,,2026-02-01T10:00:00Z,Example Movie,,,2026-02-02T10:00:00Z,US
,u,row-2,,movie-2,2025-01-01,,movie,,towatch,2026-02-03T10:00:00Z,100,,2026-02-03T10:00:00Z,Future Movie,,,,US
`

const seriesJson = JSON.stringify([
  {
    uuid: 'show-uuid-1',
    id: { imdb: null, tvdb: 12345 },
    created_at: '2026-01-01T09:00:00Z',
    title: 'Example Show',
    status: 'up_to_date',
    is_favorite: true,
    _noEpisodeData: false,
    seasons: [
      {
        number: 1,
        is_specials: false,
        episodes: [
          {
            id: { imdb: null, tvdb: 90001 },
            is_watched: true,
            name: 'Pilot',
            number: 1,
            rewatch_count: 0,
            special: false,
            watched_at: '2026-01-02T10:00:00Z',
            watched_count: 1
          },
          {
            id: { imdb: null, tvdb: 90002 },
            is_watched: false,
            name: 'Second',
            number: 2,
            rewatch_count: 0,
            special: false,
            watched_at: null,
            watched_count: 0
          }
        ]
      },
      {
        number: 0,
        is_specials: true,
        episodes: [
          {
            id: { imdb: null, tvdb: 90000 },
            is_watched: true,
            name: 'Special',
            number: 1,
            rewatch_count: 0,
            special: true,
            watched_at: '2026-01-03T10:00:00Z',
            watched_count: 1
          }
        ]
      }
    ]
  },
  {
    uuid: 'show-uuid-2',
    id: { imdb: null, tvdb: 67890 },
    created_at: '2026-01-04T09:00:00Z',
    title: 'Paused Show',
    status: 'stopped',
    is_favorite: false,
    _noEpisodeData: false,
    seasons: []
  }
])

const moviesJson = JSON.stringify([
  {
    uuid: 'movie-uuid-1',
    id: { imdb: 'tt1234567', tvdb: 4567 },
    created_at: '2026-02-01T10:00:00Z',
    title: 'Example Movie',
    year: 2024,
    watched_at: '2026-02-02T10:00:00Z',
    is_watched: true,
    is_favorite: false,
    rewatch_count: 0
  },
  {
    uuid: 'movie-uuid-2',
    id: { imdb: 'tt7654321', tvdb: 7654 },
    created_at: '2026-02-03T10:00:00Z',
    title: 'Future Movie',
    year: 2025,
    watched_at: null,
    is_watched: false,
    is_favorite: false,
    rewatch_count: 0
  }
])

describe('TV Time GDPR reader', () => {
  it('extracts watched episodes, shows, watched movies, and movie list rows', () => {
    const library = parseTvTimeCsvEntries({
      episodeTracking,
      showData,
      movieTracking
    })

    expect(library.source).toBe('tvtime-gdpr')
    expect(library.watchedEpisodes).toHaveLength(3)
    expect(library.watchedEpisodes[2]?.isSpecial).toBe(true)
    expect(library.shows).toHaveLength(2)
    expect(library.shows.find((show) => show.title === 'Example Show')?.favorited).toBe(true)
    expect(library.watchedMovies).toHaveLength(1)
    expect(library.movieList).toHaveLength(1)
    expect(library.diagnostics.some((diagnostic) => diagnostic.code === 'sensitive-files-ignored')).toBe(true)
  })

  it('builds a provider-aware transfer plan', () => {
    const library = parseTvTimeCsvEntries({
      episodeTracking,
      showData,
      movieTracking
    })

    const plan = buildTransferPlan(library, {
      watchedEpisodes: true,
      watchedMovies: false,
      showLibrary: true,
      movieWatchlist: false,
      ratings: false,
      watchedAt: false,
      rewatches: false
    })

    expect(plan.counts.episodes).toBe(3)
    expect(plan.counts.shows).toBe(2)
    expect(plan.counts.watchedMovies).toBe(0)
    expect(plan.counts.total).toBe(5)
  })

  it('reads the supported files from a ZIP archive', async () => {
    const zip = new JSZip()
    zip.file('tracking-prod-records-v2.csv', episodeTracking)
    zip.file('user_tv_show_data.csv', showData)
    zip.file('tracking-prod-records.csv', movieTracking)
    zip.file('refresh_token.csv', 'token\nsecret-token-value\n')

    const blob = await zip.generateAsync({ type: 'blob' }) as Blob & { name?: string }
    Object.defineProperty(blob, 'name', { value: 'gdpr-data.zip' })

    const library = await readTvTimeGdprZip(blob)

    expect(library.watchedEpisodes).toHaveLength(3)
    expect(library.watchedMovies).toHaveLength(1)
    expect(library.diagnostics.find((diagnostic) => diagnostic.code === 'sensitive-files-ignored')).toBeTruthy()
  })

  it('extracts the current TV Time JSON export format with external ids', () => {
    const library = parseTvTimeJsonEntries({
      seriesJson,
      moviesJson
    })

    expect(library.watchedEpisodes).toHaveLength(2)
    expect(library.watchedEpisodes[0]).toMatchObject({
      showTitle: 'Example Show',
      episodeTitle: 'Special',
      seasonNumber: 0,
      episodeNumber: 1,
      isSpecial: true
    })
    expect(library.watchedEpisodes.every((episode) => episode.source.tvdbId)).toBe(true)
    expect(library.shows).toHaveLength(2)
    expect(library.shows.find((show) => show.title === 'Paused Show')?.archived).toBe(true)
    expect(library.watchedMovies).toHaveLength(1)
    expect(library.watchedMovies[0]?.source.imdbId).toBe('tt1234567')
    expect(library.movieList).toHaveLength(1)
    expect(library.diagnostics.find((diagnostic) => diagnostic.code === 'json-export-detected')).toBeTruthy()
  })

  it('detects TV Time JSON export files from a ZIP archive', async () => {
    const zip = new JSZip()
    zip.file('tvtime-series-2026-07-14.json', seriesJson)
    zip.file('tvtime-movies-2026-07-14.json', moviesJson)
    zip.file('tvtime-summary-2026-07-14.html', '<html>Summary</html>')

    const blob = await zip.generateAsync({ type: 'blob' }) as Blob & { name?: string }
    Object.defineProperty(blob, 'name', { value: 'tvtime-export.zip' })

    const library = await readTvTimeGdprZip(blob)

    expect(library.watchedEpisodes).toHaveLength(2)
    expect(library.watchedMovies).toHaveLength(1)
    expect(library.movieList).toHaveLength(1)
  })
})
