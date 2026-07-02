import type {
  ImportResultLine,
  ProviderCapabilities,
  ProviderDescriptor,
  ProviderMovieMatch,
  ProviderShowMatch
} from '../domain/migration'

export interface ProviderShowMatchRequest {
  sourceShowId: string
  title: string
  episodes: Array<{
    sourceEpisodeId: string
    seasonNumber: number
    episodeNumber: number
  }>
}

export interface ProviderMovieMatchRequest {
  sourceMovieId: string
  title: string
  releaseDate?: string
}

export interface ProviderMatchRequest {
  shows: ProviderShowMatchRequest[]
  movies: ProviderMovieMatchRequest[]
}

export interface ProviderImportOperation {
  operationId: string
  kind: 'episode-watched' | 'show-library' | 'movie-watched' | 'movie-list'
  providerId: string
  state?: 'followed' | 'watchlist' | 'watched'
}

export interface MediaProvider {
  descriptor: ProviderDescriptor
  capabilities: ProviderCapabilities
  match(input: ProviderMatchRequest): Promise<{
    shows: ProviderShowMatch[]
    movies: ProviderMovieMatch[]
  }>
  import(input: {
    accessToken: string
    operations: ProviderImportOperation[]
  }): Promise<ImportResultLine[]>
}
