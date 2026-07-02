import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { buildTransferPlan } from '~~/core/application/build-transfer-plan'
import { parseTvTimeCsvEntries, readTvTimeGdprZip } from '~~/infra/sources/tvtime-gdpr-reader'

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
})
