export type SourceProvider = 'tvtime'
export type SourceExportKind = 'tvtime-gdpr'

export interface SourceIdentity {
  provider: SourceProvider
  rawKey?: string
  showId?: string
  episodeId?: string
  movieId?: string
  imdbId?: string
  tvdbId?: string
}

export interface WatchedEpisode {
  id: string
  source: SourceIdentity
  showTitle: string
  episodeTitle?: string
  seasonNumber: number
  episodeNumber: number
  watchedAt?: string
  runtimeMinutes?: number
  watchedCount?: number
  rewatchCount?: number
  isSpecial: boolean
}

export interface ShowListItem {
  id: string
  source: SourceIdentity
  title: string
  episodeCountSeen?: number
  status?: string
  followed: boolean
  favorited: boolean
  archived: boolean
}

export interface WatchedMovie {
  id: string
  source: SourceIdentity
  title: string
  releaseDate?: string
  watchedAt?: string
  rewatchCount?: number
}

export interface MovieListItem {
  id: string
  source: SourceIdentity
  title: string
  releaseDate?: string
  state: 'followed' | 'watchlist'
}

export interface ImportDiagnostics {
  severity: 'info' | 'warning' | 'error'
  code: string
  message: string
  count?: number
}

export interface NormalizedLibrary {
  source: SourceExportKind
  importedAt: string
  watchedEpisodes: WatchedEpisode[]
  shows: ShowListItem[]
  watchedMovies: WatchedMovie[]
  movieList: MovieListItem[]
  diagnostics: ImportDiagnostics[]
}

export function stableMediaId(parts: Array<number | string | undefined>): string {
  return parts
    .filter((part): part is number | string => part !== undefined && part !== '')
    .map((part) => String(part).trim().toLowerCase())
    .join('|')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9|.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function parsePositiveInteger(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value
  }

  if (typeof value !== 'string') {
    return undefined
  }

  const parsed = Number.parseInt(value.trim(), 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

export function parseOptionalInteger(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value
  }

  if (typeof value !== 'string' || value.trim() === '') {
    return undefined
  }

  const parsed = Number.parseInt(value.trim(), 10)
  return Number.isInteger(parsed) ? parsed : undefined
}

export function toIsoDateTime(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined
  }

  const trimmed = value.trim()
  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? trimmed : parsed.toISOString()
}

export function toIsoDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined
  }

  const trimmed = value.trim()
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) {
    return /^\d{4}(-\d{2})?(-\d{2})?$/.test(trimmed) ? trimmed : undefined
  }

  return parsed.toISOString().slice(0, 10)
}

export function truthyFlag(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value !== 'string') {
    return false
  }

  return ['1', 'true', 'yes', 'y'].includes(value.trim().toLowerCase())
}
