import type { H3Event } from 'h3'
import type {
  ImportResultLine,
  ProviderMovieMatch,
  ProviderShowMatch
} from '~~/core/domain/migration'
import type {
  ProviderImportOperation,
  ProviderMatchRequest
} from '~~/core/ports/media-provider'
import { betaSeriesRequest } from './betaseries-client'

interface BetaSeriesShow {
  id?: number | string
  title?: string
  original_title?: string
}

interface BetaSeriesMovie {
  id?: number | string
  title?: string
  original_title?: string
  release_date?: string
  year?: number | string
}

interface BetaSeriesEpisode {
  id?: number | string
  season?: number | string
  episode?: number | string
  number?: number | string
  code?: string
}

export const betaseriesCapabilities = {
  watchedEpisodes: true,
  watchedMovies: true,
  showLibrary: true,
  movieWatchlist: true,
  ratings: false,
  watchedAt: false,
  rewatches: false
} as const

export async function matchWithBetaSeries(
  event: H3Event,
  input: ProviderMatchRequest
): Promise<{ shows: ProviderShowMatch[], movies: ProviderMovieMatch[] }> {
  const shows: ProviderShowMatch[] = []
  const movies: ProviderMovieMatch[] = []

  for (const show of input.shows) {
    try {
      const providerShow = await findShow(event, show.title)
      if (!providerShow?.id) {
        shows.push({
          sourceShowId: show.sourceShowId,
          title: show.title,
          confidence: 0,
          status: 'missing',
          episodes: show.episodes.map((episode) => ({
            sourceEpisodeId: episode.sourceEpisodeId,
            seasonNumber: episode.seasonNumber,
            episodeNumber: episode.episodeNumber,
            status: 'missing'
          }))
        })
        continue
      }

      const episodes = await findEpisodesForShow(event, String(providerShow.id))
      const episodeMatches = show.episodes.map((episode) => {
        const providerEpisode = episodes.find((candidate) =>
          Number(candidate.season) === episode.seasonNumber
          && Number(candidate.episode ?? candidate.number) === episode.episodeNumber
        )

        return {
          sourceEpisodeId: episode.sourceEpisodeId,
          seasonNumber: episode.seasonNumber,
          episodeNumber: episode.episodeNumber,
          providerEpisodeId: providerEpisode?.id ? String(providerEpisode.id) : undefined,
          status: providerEpisode?.id ? 'matched' as const : 'missing' as const
        }
      })

      shows.push({
        sourceShowId: show.sourceShowId,
        title: show.title,
        providerShowId: String(providerShow.id),
        providerTitle: providerShow.title ?? providerShow.original_title,
        confidence: confidence(show.title, providerShow.title ?? providerShow.original_title ?? ''),
        status: 'matched',
        episodes: episodeMatches
      })
    } catch (error) {
      shows.push({
        sourceShowId: show.sourceShowId,
        title: show.title,
        confidence: 0,
        status: 'error',
        episodes: show.episodes.map((episode) => ({
          sourceEpisodeId: episode.sourceEpisodeId,
          seasonNumber: episode.seasonNumber,
          episodeNumber: episode.episodeNumber,
          status: 'error',
          message: error instanceof Error ? error.message : 'Show match failed.'
        })),
        message: error instanceof Error ? error.message : 'Show match failed.'
      })
    }
  }

  for (const movie of input.movies) {
    try {
      const providerMovie = await findMovie(event, movie.title, movie.releaseDate)
      movies.push(providerMovie?.id
        ? {
            sourceMovieId: movie.sourceMovieId,
            title: movie.title,
            providerMovieId: String(providerMovie.id),
            providerTitle: providerMovie.title ?? providerMovie.original_title,
            confidence: confidence(movie.title, providerMovie.title ?? providerMovie.original_title ?? ''),
            status: 'matched'
          }
        : {
            sourceMovieId: movie.sourceMovieId,
            title: movie.title,
            confidence: 0,
            status: 'missing'
          })
    } catch (error) {
      movies.push({
        sourceMovieId: movie.sourceMovieId,
        title: movie.title,
        confidence: 0,
        status: 'error',
        message: error instanceof Error ? error.message : 'Movie match failed.'
      })
    }
  }

  return { shows, movies }
}

export async function importToBetaSeries(
  event: H3Event,
  accessToken: string,
  operations: ProviderImportOperation[]
): Promise<ImportResultLine[]> {
  const results: ImportResultLine[] = []

  for (const operation of operations) {
    try {
      await betaSeriesRequest(event, {
        ...mapBetaSeriesOperationRequest(operation),
        accessToken
      })

      results.push({
        operationId: operation.operationId,
        status: 'success',
        message: 'Imported'
      })
    } catch (error) {
      results.push({
        operationId: operation.operationId,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Import failed'
      })
    }
  }

  return results
}

export function mapBetaSeriesOperationRequest(operation: ProviderImportOperation) {
  if (operation.kind === 'episode-watched') {
    return {
      method: 'POST' as const,
      path: '/episodes/watched',
      body: { id: operation.providerId, bulk: 'false' }
    }
  }

  if (operation.kind === 'show-library') {
    return {
      method: 'POST' as const,
      path: '/shows/show',
      body: { id: operation.providerId }
    }
  }

  if (operation.kind === 'movie-watched') {
    return {
      method: 'POST' as const,
      path: '/movies/movie',
      body: { id: operation.providerId, state: '1' }
    }
  }

  return {
    method: 'POST' as const,
    path: '/movies/movie',
    body: { id: operation.providerId, state: '0' }
  }
}

async function findShow(event: H3Event, title: string): Promise<BetaSeriesShow | undefined> {
  const response = await betaSeriesRequest<Record<string, unknown>>(event, {
    method: 'GET',
    path: '/shows/search',
    query: {
      title: `%${title.trim().toLowerCase()}%`,
      nbpp: 5,
      order: 'popularity',
      fields: 'id,title,original_title'
    }
  })

  return pickBest(title, pickArray<BetaSeriesShow>(response, 'shows'))
}

async function findEpisodesForShow(event: H3Event, showId: string): Promise<BetaSeriesEpisode[]> {
  const response = await betaSeriesRequest<Record<string, unknown>>(event, {
    method: 'GET',
    path: '/shows/episodes',
    query: {
      id: showId,
      fields: 'id,season,episode,number,code'
    }
  })

  return pickArray<BetaSeriesEpisode>(response, 'episodes')
}

async function findMovie(
  event: H3Event,
  title: string,
  releaseDate?: string
): Promise<BetaSeriesMovie | undefined> {
  const primary = await betaSeriesRequest<Record<string, unknown>>(event, {
    method: 'GET',
    path: '/movies/search',
    query: {
      title,
      year: releaseDate?.slice(0, 4),
      nbpp: 5,
      fields: 'id,title,original_title,release_date,year'
    }
  }).catch(() => ({ movies: [] }))

  const primaryMatch = pickBest(title, pickArray<BetaSeriesMovie>(primary, 'movies'))
  if (primaryMatch) {
    return primaryMatch
  }

  const fallback = await betaSeriesRequest<Record<string, unknown>>(event, {
    method: 'GET',
    path: '/search/movies',
    query: {
      text: title,
      year: releaseDate?.slice(0, 4),
      nbpp: 5,
      fields: 'id,title,original_title,release_date,year'
    }
  }).catch(() => ({ movies: [] }))

  return pickBest(title, pickArray<BetaSeriesMovie>(fallback, 'movies'))
}

function pickArray<T>(response: Record<string, unknown>, key: string): T[] {
  const value = response[key]
  return Array.isArray(value) ? value as T[] : []
}

function pickBest<T extends { title?: string, original_title?: string }>(
  title: string,
  candidates: T[]
): T | undefined {
  return [...candidates].sort((a, b) =>
    confidence(title, b.title ?? b.original_title ?? '')
    - confidence(title, a.title ?? a.original_title ?? '')
  )[0]
}

function confidence(sourceTitle: string, providerTitle: string): number {
  const source = normalizeTitle(sourceTitle)
  const provider = normalizeTitle(providerTitle)
  if (!source || !provider) {
    return 0
  }
  if (source === provider) {
    return 1
  }
  if (source.includes(provider) || provider.includes(source)) {
    return 0.82
  }

  const sourceTokens = new Set(source.split(' '))
  const providerTokens = new Set(provider.split(' '))
  const shared = [...sourceTokens].filter((token) => providerTokens.has(token)).length
  return shared / Math.max(sourceTokens.size, providerTokens.size)
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
