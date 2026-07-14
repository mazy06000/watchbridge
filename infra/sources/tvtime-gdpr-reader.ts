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

export interface TvTimeJsonEntries {
  seriesJson?: string
  moviesJson?: string
}

export type TvTimeExportEntries = TvTimeCsvEntries & TvTimeJsonEntries

interface TvTimeExternalIds {
  imdb?: string | number | null
  tvdb?: string | number | null
}

interface TvTimeJsonEpisode {
  id?: TvTimeExternalIds
  is_watched?: boolean
  name?: string
  number?: number | string | null
  rewatch_count?: number | string | null
  special?: boolean
  watched_at?: string | null
  watched_count?: number | string | null
}

interface TvTimeJsonSeason {
  episodes?: TvTimeJsonEpisode[]
  is_specials?: boolean
  number?: number | string | null
}

interface TvTimeJsonSeries {
  uuid?: string
  id?: TvTimeExternalIds
  created_at?: string
  title?: string
  status?: string
  is_favorite?: boolean
  _noEpisodeData?: boolean
  seasons?: TvTimeJsonSeason[]
}

interface TvTimeJsonMovie {
  uuid?: string
  id?: TvTimeExternalIds
  created_at?: string
  title?: string
  year?: number | string | null
  watched_at?: string | null
  is_watched?: boolean
  is_favorite?: boolean
  rewatch_count?: number | string | null
}

const MAX_ZIP_BYTES = 75 * 1024 * 1024
const MAX_CSV_BYTES = 30 * 1024 * 1024

const EPISODE_TRACKING = 'tracking-prod-records-v2.csv'
const SHOW_DATA = 'user_tv_show_data.csv'
const MOVIE_TRACKING = 'tracking-prod-records.csv'
const SERIES_JSON_PATTERN = /^tvtime-series-\d{4}-\d{2}-\d{2}\.json$/i
const MOVIES_JSON_PATTERN = /^tvtime-movies-\d{4}-\d{2}-\d{2}\.json$/i

export async function readTvTimeGdprZip(file: Blob & { name?: string }): Promise<NormalizedLibrary> {
  if (!file.name?.toLowerCase().endsWith('.zip')) {
    throw new Error('Select the TV Time GDPR ZIP export.')
  }

  if (file.size > MAX_ZIP_BYTES) {
    throw new Error('The ZIP is larger than the supported private browser import limit.')
  }

  const zip = await JSZip.loadAsync(file)
  const entries: TvTimeExportEntries = {
    episodeTracking: await readZipCsv(zip, EPISODE_TRACKING),
    showData: await readZipCsv(zip, SHOW_DATA),
    movieTracking: await readZipCsv(zip, MOVIE_TRACKING),
    seriesJson: await readZipPattern(zip, SERIES_JSON_PATTERN),
    moviesJson: await readZipPattern(zip, MOVIES_JSON_PATTERN)
  }

  if (entries.seriesJson || entries.moviesJson) {
    return parseTvTimeJsonEntries(entries)
  }

  return parseTvTimeCsvEntries(entries)
}

export function parseTvTimeJsonEntries(entries: TvTimeJsonEntries): NormalizedLibrary {
  const diagnostics: ImportDiagnostics[] = [
    {
      severity: 'info',
      code: 'sensitive-files-ignored',
      message: 'Only TV Time series/movie JSON exports are parsed; the HTML summary is ignored.'
    },
    {
      severity: 'info',
      code: 'json-export-detected',
      message: 'TV Time JSON export detected. TVDB/IMDb IDs are preserved for catalog matching.'
    }
  ]

  const seriesRows = parseJsonArray<TvTimeJsonSeries>(entries.seriesJson, 'tvtime-series-*.json', diagnostics)
  const movieRows = parseJsonArray<TvTimeJsonMovie>(entries.moviesJson, 'tvtime-movies-*.json', diagnostics)

  if (!entries.seriesJson && !entries.moviesJson) {
    diagnostics.push({
      severity: 'error',
      code: 'missing-supported-json',
      message: 'No supported TV Time JSON files were found in this archive.'
    })
  }

  const watchedEpisodes = extractJsonWatchedEpisodes(seriesRows)
  const shows = extractJsonShows(seriesRows)
  const { watchedMovies, movieList } = extractJsonMovies(movieRows)

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

async function readZipPattern(zip: JSZip, pattern: RegExp): Promise<string | undefined> {
  const entry = zip.file(pattern)[0]
  if (!entry) {
    return undefined
  }

  const content = await entry.async('string')
  if (new Blob([content]).size > MAX_CSV_BYTES) {
    throw new Error(`${entry.name} is larger than the supported browser parsing limit.`)
  }

  return content
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

function parseJsonArray<T>(
  json: string | undefined,
  filename: string,
  diagnostics: ImportDiagnostics[]
): T[] {
  if (!json?.trim()) {
    return []
  }

  try {
    const parsed = JSON.parse(json) as unknown
    if (!Array.isArray(parsed)) {
      diagnostics.push({
        severity: 'warning',
        code: 'json-parse-warning',
        message: `${filename} was not an array and was skipped.`
      })
      return []
    }

    return parsed as T[]
  } catch {
    diagnostics.push({
      severity: 'warning',
      code: 'json-parse-warning',
      message: `${filename} could not be parsed and was skipped.`
    })
    return []
  }
}

function extractJsonShows(rows: TvTimeJsonSeries[]): ShowListItem[] {
  const shows: ShowListItem[] = []

  for (const row of rows) {
    const title = row.title?.trim()
    if (!title) {
      continue
    }

    const tvdbId = externalId(row.id?.tvdb)
    const imdbId = externalId(row.id?.imdb)
    const id = stableMediaId(['tvtime', 'show', tvdbId || row.uuid || title])
    const watchedEpisodes = (row.seasons ?? [])
      .flatMap((season) => season.episodes ?? [])
      .filter(isJsonEpisodeWatched)
      .length

    shows.push({
      id,
      source: {
        provider: 'tvtime',
        rawKey: row.uuid,
        showId: tvdbId ?? row.uuid,
        tvdbId,
        imdbId
      },
      title,
      episodeCountSeen: watchedEpisodes,
      status: row.status,
      followed: true,
      favorited: Boolean(row.is_favorite),
      archived: row.status === 'stopped'
    })
  }

  return shows.sort((a, b) => a.title.localeCompare(b.title))
}

function extractJsonWatchedEpisodes(rows: TvTimeJsonSeries[]): WatchedEpisode[] {
  const byId = new Map<string, WatchedEpisode>()

  for (const row of rows) {
    const showTitle = row.title?.trim()
    if (!showTitle) {
      continue
    }

    const showTvdbId = externalId(row.id?.tvdb)

    for (const season of row.seasons ?? []) {
      const seasonNumber = parseOptionalInteger(season.number)
      if (seasonNumber === undefined || seasonNumber < 0) {
        continue
      }

      for (const episode of season.episodes ?? []) {
        if (!isJsonEpisodeWatched(episode)) {
          continue
        }

        const episodeNumber = parsePositiveInteger(episode.number)
        if (!episodeNumber) {
          continue
        }

        const episodeTvdbId = externalId(episode.id?.tvdb)
        const episodeImdbId = externalId(episode.id?.imdb)
        const id = stableMediaId([
          'tvtime',
          'episode',
          episodeTvdbId || showTvdbId || row.uuid || showTitle,
          seasonNumber,
          episodeNumber
        ])

        const item: WatchedEpisode = {
          id,
          source: {
            provider: 'tvtime',
            rawKey: row.uuid,
            showId: showTvdbId ?? row.uuid,
            episodeId: episodeTvdbId,
            tvdbId: episodeTvdbId,
            imdbId: episodeImdbId
          },
          showTitle,
          episodeTitle: episode.name?.trim() || undefined,
          seasonNumber,
          episodeNumber,
          watchedAt: toIsoDateTime(episode.watched_at ?? undefined),
          watchedCount: parseOptionalInteger(episode.watched_count),
          rewatchCount: parseOptionalInteger(episode.rewatch_count),
          isSpecial: Boolean(episode.special || season.is_specials || seasonNumber === 0)
        }

        byId.set(id, item)
      }
    }
  }

  return [...byId.values()].sort((a, b) =>
    a.showTitle.localeCompare(b.showTitle)
    || a.seasonNumber - b.seasonNumber
    || a.episodeNumber - b.episodeNumber
  )
}

function extractJsonMovies(rows: TvTimeJsonMovie[]): {
  watchedMovies: WatchedMovie[]
  movieList: MovieListItem[]
} {
  const watched = new Map<string, WatchedMovie>()
  const list = new Map<string, MovieListItem>()

  for (const row of rows) {
    const title = row.title?.trim()
    if (!title) {
      continue
    }

    const imdbId = externalId(row.id?.imdb)
    const tvdbId = externalId(row.id?.tvdb)
    const movieId = tvdbId ?? imdbId ?? row.uuid
    const releaseDate = yearToIsoDate(row.year)
    const baseId = stableMediaId(['tvtime', 'movie', movieId || title, releaseDate])
    const source = {
      provider: 'tvtime' as const,
      rawKey: row.uuid,
      movieId,
      tvdbId,
      imdbId
    }

    if (row.is_watched || row.watched_at) {
      watched.set(baseId, {
        id: baseId,
        source,
        title,
        releaseDate,
        watchedAt: toIsoDateTime(row.watched_at ?? row.created_at),
        rewatchCount: parseOptionalInteger(row.rewatch_count)
      })
      continue
    }

    list.set(baseId, {
      id: baseId,
      source,
      title,
      releaseDate,
      state: 'watchlist'
    })
  }

  return {
    watchedMovies: [...watched.values()].sort((a, b) => a.title.localeCompare(b.title)),
    movieList: [...list.values()].sort((a, b) => a.title.localeCompare(b.title))
  }
}

function isJsonEpisodeWatched(episode: TvTimeJsonEpisode): boolean {
  return Boolean(
    episode.is_watched
    || episode.watched_at
    || (parseOptionalInteger(episode.watched_count) ?? 0) > 0
  )
}

function externalId(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

function yearToIsoDate(value: unknown): string | undefined {
  const year = parseOptionalInteger(value)
  return year && year > 0 ? String(year).padStart(4, '0') : undefined
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
