import JSZip from 'jszip'
import Papa from 'papaparse'
import {
  parseOptionalInteger,
  parsePositiveInteger,
  stableMediaId,
  toIsoDate,
  toIsoDateTime,
  truthyFlag,
  type ImportDiagnostics,
  type MovieListItem,
  type NormalizedLibrary,
  type ShowListItem,
  type WatchedEpisode,
  type WatchedMovie
} from '~~/core/domain/media'

type CsvRecord = Record<string, string | undefined>

export interface TvTimeCsvEntries {
  episodeTracking?: string
  showData?: string
  movieTracking?: string
}

const MAX_ZIP_BYTES = 75 * 1024 * 1024
const MAX_CSV_BYTES = 30 * 1024 * 1024

const EPISODE_TRACKING = 'tracking-prod-records-v2.csv'
const SHOW_DATA = 'user_tv_show_data.csv'
const MOVIE_TRACKING = 'tracking-prod-records.csv'

export async function readTvTimeGdprZip(file: Blob & { name?: string }): Promise<NormalizedLibrary> {
  if (!file.name?.toLowerCase().endsWith('.zip')) {
    throw new Error('Select the TV Time GDPR ZIP export.')
  }

  if (file.size > MAX_ZIP_BYTES) {
    throw new Error('The ZIP is larger than the supported private browser import limit.')
  }

  const zip = await JSZip.loadAsync(file)
  const entries: TvTimeCsvEntries = {
    episodeTracking: await readZipCsv(zip, EPISODE_TRACKING),
    showData: await readZipCsv(zip, SHOW_DATA),
    movieTracking: await readZipCsv(zip, MOVIE_TRACKING)
  }

  return parseTvTimeCsvEntries(entries)
}

export function parseTvTimeCsvEntries(entries: TvTimeCsvEntries): NormalizedLibrary {
  const diagnostics: ImportDiagnostics[] = [
    {
      severity: 'info',
      code: 'sensitive-files-ignored',
      message: 'Only watch-history CSVs are parsed; token, IP, device, login, and social CSVs are ignored.'
    }
  ]

  const episodeRows = parseCsv(entries.episodeTracking, EPISODE_TRACKING, diagnostics)
  const showRows = parseCsv(entries.showData, SHOW_DATA, diagnostics)
  const movieRows = parseCsv(entries.movieTracking, MOVIE_TRACKING, diagnostics)

  if (!entries.episodeTracking && !entries.movieTracking && !entries.showData) {
    diagnostics.push({
      severity: 'error',
      code: 'missing-supported-csvs',
      message: 'No supported TV Time CSV files were found in this archive.'
    })
  }

  const watchedEpisodes = extractWatchedEpisodes(episodeRows)
  const shows = extractShows(showRows, episodeRows)
  const { watchedMovies, movieList } = extractMovies(movieRows)

  if (watchedEpisodes.length === 0) {
    diagnostics.push({
      severity: 'warning',
      code: 'no-episodes',
      message: 'No watched TV episodes were detected in the supported TV Time files.'
    })
  }

  return {
    source: 'tvtime-gdpr',
    importedAt: new Date().toISOString(),
    watchedEpisodes,
    shows,
    watchedMovies,
    movieList,
    diagnostics
  }
}

async function readZipCsv(zip: JSZip, name: string): Promise<string | undefined> {
  const entry = zip.file(name)
  if (!entry) {
    return undefined
  }

  const csv = await entry.async('string')
  if (new Blob([csv]).size > MAX_CSV_BYTES) {
    throw new Error(`${name} is larger than the supported browser parsing limit.`)
  }

  return csv
}

function parseCsv(
  csv: string | undefined,
  filename: string,
  diagnostics: ImportDiagnostics[]
): CsvRecord[] {
  if (!csv?.trim()) {
    return []
  }

  const result = Papa.parse<CsvRecord>(csv, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.trim(),
    transform: (value) => value.trim()
  })

  if (result.errors.length > 0) {
    diagnostics.push({
      severity: 'warning',
      code: 'csv-parse-warning',
      message: `${filename} had ${result.errors.length} CSV parse warning(s).`,
      count: result.errors.length
    })
  }

  return result.data.filter((row) => Object.values(row).some((value) => value && value.trim() !== ''))
}

function extractWatchedEpisodes(rows: CsvRecord[]): WatchedEpisode[] {
  const byId = new Map<string, WatchedEpisode>()

  for (const row of rows) {
    const showTitle = row.series_name?.trim()
    const seasonNumber = parseOptionalInteger(row.season_number ?? row.s_no)
    const episodeNumber = parsePositiveInteger(row.episode_number ?? row.ep_no)

    if (!showTitle || seasonNumber === undefined || seasonNumber < 0 || !episodeNumber) {
      continue
    }

    const showId = row.s_id?.trim()
    const episodeId = (row.episode_id ?? row.ep_id)?.trim()
    const id = stableMediaId([
      'tvtime',
      'episode',
      showId || showTitle,
      seasonNumber,
      episodeNumber,
      episodeId
    ])

    const item: WatchedEpisode = {
      id,
      source: {
        provider: 'tvtime',
        rawKey: row.key,
        showId,
        episodeId
      },
      showTitle,
      seasonNumber,
      episodeNumber,
      watchedAt: toIsoDateTime(row.created_at ?? row.updated_at),
      runtimeMinutes: parseOptionalInteger(row.runtime),
      isSpecial: truthyFlag(row.is_special) || seasonNumber === 0
    }

    const existing = byId.get(id)
    if (!existing || (item.watchedAt && item.watchedAt > (existing.watchedAt ?? ''))) {
      byId.set(id, item)
    }
  }

  return [...byId.values()].sort((a, b) =>
    a.showTitle.localeCompare(b.showTitle)
    || a.seasonNumber - b.seasonNumber
    || a.episodeNumber - b.episodeNumber
  )
}

function extractShows(showRows: CsvRecord[], episodeRows: CsvRecord[]): ShowListItem[] {
  const byId = new Map<string, ShowListItem>()

  for (const row of showRows) {
    const title = row.tv_show_name?.trim()
    if (!title) {
      continue
    }

    const showId = row.tv_show_id?.trim()
    const id = stableMediaId(['tvtime', 'show', showId || title])
    byId.set(id, {
      id,
      source: {
        provider: 'tvtime',
        showId
      },
      title,
      episodeCountSeen: parseOptionalInteger(row.nb_episodes_seen),
      followed: truthyFlag(row.is_followed),
      favorited: truthyFlag(row.is_favorited),
      archived: false
    })
  }

  for (const row of episodeRows) {
    const title = row.series_name?.trim()
    const showId = row.s_id?.trim()

    if (!title || !showId || (row.season_number || row.episode_number || row.ep_no)) {
      continue
    }

    const id = stableMediaId(['tvtime', 'show', showId])
    const existing = byId.get(id)
    byId.set(id, {
      id,
      source: {
        provider: 'tvtime',
        rawKey: row.key,
        showId
      },
      title,
      episodeCountSeen: existing?.episodeCountSeen,
      followed: existing?.followed || truthyFlag(row.is_followed),
      favorited: existing?.favorited ?? false,
      archived: existing?.archived || truthyFlag(row.is_archived)
    })
  }

  return [...byId.values()].sort((a, b) => a.title.localeCompare(b.title))
}

function extractMovies(rows: CsvRecord[]): {
  watchedMovies: WatchedMovie[]
  movieList: MovieListItem[]
} {
  const watched = new Map<string, WatchedMovie>()
  const list = new Map<string, MovieListItem>()

  for (const row of rows) {
    const title = row.movie_name?.trim()
    const type = row.type?.trim().toLowerCase()
    if (!title || !type || row.entity_type?.trim() !== 'movie') {
      continue
    }

    const movieId = row.uuid?.trim()
    const baseId = stableMediaId(['tvtime', 'movie', movieId || title, toIsoDate(row.release_date)])

    if (type === 'watch') {
      watched.set(baseId, {
        id: baseId,
        source: {
          provider: 'tvtime',
          rawKey: row['type-uuid-n'],
          movieId
        },
        title,
        releaseDate: toIsoDate(row.release_date),
        watchedAt: toIsoDateTime(row.watch_date_range_key ?? row.created_at)
      })
      continue
    }

    if (type === 'rewatch_count') {
      const existing = watched.get(baseId)
      if (existing) {
        existing.rewatchCount = parseOptionalInteger(row.rewatch_count)
      }
      continue
    }

    if (type === 'towatch' || type === 'follow') {
      list.set(`${baseId}:${type}`, {
        id: `${baseId}:${type}`,
        source: {
          provider: 'tvtime',
          rawKey: row['type-uuid-n'],
          movieId
        },
        title,
        releaseDate: toIsoDate(row.release_date),
        state: type === 'towatch' ? 'watchlist' : 'followed'
      })
    }
  }

  return {
    watchedMovies: [...watched.values()].sort((a, b) => a.title.localeCompare(b.title)),
    movieList: [...list.values()].sort((a, b) => a.title.localeCompare(b.title))
  }
}
