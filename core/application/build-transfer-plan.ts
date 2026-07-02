import type { NormalizedLibrary } from '../domain/media'
import type { ProviderCapabilities, TransferOperation, TransferPlan } from '../domain/migration'

export function buildTransferPlan(
  library: NormalizedLibrary,
  capabilities: ProviderCapabilities
): TransferPlan {
  const operations: TransferOperation[] = []

  if (capabilities.watchedEpisodes) {
    for (const item of library.watchedEpisodes) {
      operations.push({
        id: item.id,
        kind: 'episode-watched',
        title: `${item.showTitle} S${item.seasonNumber}E${item.episodeNumber}`,
        item
      })
    }
  }

  if (capabilities.showLibrary) {
    for (const item of library.shows.filter((show) => show.followed || show.favorited)) {
      operations.push({
        id: item.id,
        kind: 'show-library',
        title: item.title,
        item
      })
    }
  }

  if (capabilities.watchedMovies) {
    for (const item of library.watchedMovies) {
      operations.push({
        id: item.id,
        kind: 'movie-watched',
        title: item.title,
        item
      })
    }
  }

  if (capabilities.movieWatchlist) {
    for (const item of library.movieList) {
      operations.push({
        id: item.id,
        kind: 'movie-list',
        title: item.title,
        item
      })
    }
  }

  return {
    source: library.source,
    operations,
    counts: {
      episodes: operations.filter((operation) => operation.kind === 'episode-watched').length,
      shows: operations.filter((operation) => operation.kind === 'show-library').length,
      watchedMovies: operations.filter((operation) => operation.kind === 'movie-watched').length,
      movieList: operations.filter((operation) => operation.kind === 'movie-list').length,
      total: operations.length
    }
  }
}

export function summarizeLibrary(library: NormalizedLibrary) {
  return {
    watchedEpisodes: library.watchedEpisodes.length,
    shows: library.shows.length,
    watchedMovies: library.watchedMovies.length,
    movieList: library.movieList.length,
    warnings: library.diagnostics.filter((diagnostic) => diagnostic.severity !== 'info').length
  }
}
