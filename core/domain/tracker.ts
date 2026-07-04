import type { NormalizedLibrary } from './media'

export type CatalogTitleType = 'movie' | 'series'
export type LibraryStatus = 'watchlist' | 'watching' | 'completed' | 'paused' | 'dropped'

export interface CatalogNextRelease {
  kind: 'movie' | 'episode'
  title?: string
  date?: string
  seasonNumber?: number
  episodeNumber?: number
  source: string
}

export interface UserAccount {
  id: string
  email: string
  displayName?: string
  avatarUrl?: string
  createdAt: string
  updatedAt: string
  lastLoginAt?: string
}

export interface CatalogTitle {
  id: string
  imdbId?: string
  type: CatalogTitleType
  primaryTitle: string
  originalTitle?: string
  primaryImageUrl?: string
  startYear?: number
  endYear?: number
  runtimeSeconds?: number
  plot?: string
  ratingAverage?: number
  ratingCount?: number
  genres: string[]
  nextRelease?: CatalogNextRelease
  sourcePayload?: unknown
  fetchedAt?: string
  updatedAt?: string
}

export interface CatalogEpisode {
  id: string
  imdbId?: string
  seriesTitleId: string
  seasonNumber: number
  episodeNumber: number
  primaryTitle: string
  airDate?: string
  runtimeSeconds?: number
  plot?: string
  fetchedAt?: string
  updatedAt?: string
}

export interface LibraryItem {
  userId: string
  title: CatalogTitle
  status: LibraryStatus
  favorite: boolean
  addedAt: string
  updatedAt: string
}

export interface WatchEvent {
  id: string
  userId: string
  titleId?: string
  episodeId?: string
  watchedAt: string
  source: 'manual' | 'import' | 'provider'
  sourceEventKey?: string
  createdAt: string
}

export interface ImportJob {
  id: string
  userId: string
  source: NormalizedLibrary['source']
  status: 'preview' | 'running' | 'completed' | 'failed'
  totalItems: number
  importedItems: number
  failedItems: number
  createdAt: string
  completedAt?: string
}

export interface LibrarySummary {
  watching: number
  watchlist: number
  completed: number
  paused: number
  dropped: number
  favorites: number
}

export interface TrackerDashboard {
  summary: LibrarySummary
  continueWatching: LibraryItem[]
  watchlist: LibraryItem[]
  recentlyWatched: WatchEvent[]
}

export interface ImportCommitResult {
  job: ImportJob
  importedItems: number
  skippedItems: number
  failedItems: number
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function slugifyTitle(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function catalogTitleId(input: { imdbId?: string, sourceKey?: string, title: string }): string {
  if (input.imdbId) {
    return input.imdbId
  }

  const source = input.sourceKey ? slugifyTitle(input.sourceKey) : slugifyTitle(input.title)
  return `local-${source}`
}
