import type {
  MovieListItem,
  NormalizedLibrary,
  ShowListItem,
  WatchedEpisode,
  WatchedMovie
} from './media'

export type ProviderId = 'betaseries' | (string & {})

export interface ProviderCapabilities {
  watchedEpisodes: boolean
  watchedMovies: boolean
  showLibrary: boolean
  movieWatchlist: boolean
  ratings: boolean
  watchedAt: boolean
  rewatches: boolean
}

export interface ProviderDescriptor {
  id: ProviderId
  name: string
  capabilities: ProviderCapabilities
  authMode: 'oauth2'
  configured: boolean
  configuration?: {
    ready: boolean
    missing: string[]
  }
}

export type TransferOperationKind =
  | 'episode-watched'
  | 'show-library'
  | 'movie-watched'
  | 'movie-list'

export interface TransferOperationBase {
  id: string
  kind: TransferOperationKind
  title: string
}

export interface EpisodeWatchedOperation extends TransferOperationBase {
  kind: 'episode-watched'
  item: WatchedEpisode
}

export interface ShowLibraryOperation extends TransferOperationBase {
  kind: 'show-library'
  item: ShowListItem
}

export interface MovieWatchedOperation extends TransferOperationBase {
  kind: 'movie-watched'
  item: WatchedMovie
}

export interface MovieListOperation extends TransferOperationBase {
  kind: 'movie-list'
  item: MovieListItem
}

export type TransferOperation =
  | EpisodeWatchedOperation
  | ShowLibraryOperation
  | MovieWatchedOperation
  | MovieListOperation

export interface TransferPlan {
  source: NormalizedLibrary['source']
  operations: TransferOperation[]
  counts: {
    episodes: number
    shows: number
    watchedMovies: number
    movieList: number
    total: number
  }
}

export interface ProviderShowMatch {
  sourceShowId: string
  title: string
  providerShowId?: string
  providerTitle?: string
  confidence: number
  status: 'matched' | 'ambiguous' | 'missing' | 'error'
  episodes: ProviderEpisodeMatch[]
  message?: string
}

export interface ProviderEpisodeMatch {
  sourceEpisodeId: string
  seasonNumber: number
  episodeNumber: number
  providerEpisodeId?: string
  status: 'matched' | 'missing' | 'error'
  message?: string
}

export interface ProviderMovieMatch {
  sourceMovieId: string
  title: string
  providerMovieId?: string
  providerTitle?: string
  confidence: number
  status: 'matched' | 'ambiguous' | 'missing' | 'error'
  message?: string
}

export interface ImportResultLine {
  operationId: string
  status: 'success' | 'skipped' | 'failed'
  message: string
}
