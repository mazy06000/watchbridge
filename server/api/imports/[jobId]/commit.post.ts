import { z } from 'zod'
import { commitTvTimeLibraryImport } from '~~/core/application/import-tvtime'
import { requireUser } from '~~/server/utils/auth'
import { getTrackerRepository } from '~~/server/utils/tracker-repository'

const sourceIdentitySchema = z.object({
  provider: z.literal('tvtime'),
  rawKey: z.string().optional(),
  showId: z.string().optional(),
  episodeId: z.string().optional(),
  movieId: z.string().optional(),
  imdbId: z.string().optional(),
  tvdbId: z.string().optional()
})

const librarySchema = z.object({
  source: z.literal('tvtime-gdpr'),
  importedAt: z.string(),
  watchedEpisodes: z.array(z.object({
    id: z.string(),
    source: sourceIdentitySchema,
    showTitle: z.string(),
    episodeTitle: z.string().optional(),
    seasonNumber: z.number(),
    episodeNumber: z.number(),
    watchedAt: z.string().optional(),
    runtimeMinutes: z.number().optional(),
    watchedCount: z.number().optional(),
    rewatchCount: z.number().optional(),
    isSpecial: z.boolean()
  })),
  shows: z.array(z.object({
    id: z.string(),
    source: sourceIdentitySchema,
    title: z.string(),
    episodeCountSeen: z.number().optional(),
    status: z.string().optional(),
    followed: z.boolean(),
    favorited: z.boolean(),
    archived: z.boolean()
  })),
  watchedMovies: z.array(z.object({
    id: z.string(),
    source: sourceIdentitySchema,
    title: z.string(),
    releaseDate: z.string().optional(),
    watchedAt: z.string().optional(),
    rewatchCount: z.number().optional()
  })),
  movieList: z.array(z.object({
    id: z.string(),
    source: sourceIdentitySchema,
    title: z.string(),
    releaseDate: z.string().optional(),
    state: z.enum(['followed', 'watchlist'])
  })),
  diagnostics: z.array(z.object({
    severity: z.enum(['info', 'warning', 'error']),
    code: z.string(),
    message: z.string(),
    count: z.number().optional()
  }))
})

export default defineEventHandler(async (event) => {
  setNoStoreHeaders(event)
  const user = await requireUser(event)
  const body = z.object({ library: librarySchema }).parse(await readBody(event))
  const result = await commitTvTimeLibraryImport({
    userId: user.id,
    jobId: getRouterParam(event, 'jobId') ?? '',
    library: body.library,
    repository: getTrackerRepository(event)
  })
  return { result }
})
