import { z } from 'zod'
import { requireUser } from '~~/server/utils/auth'
import { getTrackerRepository } from '~~/server/utils/tracker-repository'

const bodySchema = z.object({
  episode: z.object({
    id: z.string().min(1),
    imdbId: z.string().optional(),
    seriesTitleId: z.string().min(1),
    seasonNumber: z.number().int().positive(),
    episodeNumber: z.number().int().positive(),
    primaryTitle: z.string().min(1),
    airDate: z.string().optional(),
    runtimeSeconds: z.number().int().optional(),
    plot: z.string().optional()
  }),
  watched: z.boolean(),
  watchedAt: z.string().datetime().optional()
})

export default defineEventHandler(async (event) => {
  setNoStoreHeaders(event)
  const user = await requireUser(event)
  const body = bodySchema.parse(await readBody(event))
  await getTrackerRepository(event).setEpisodeProgress({
    userId: user.id,
    episode: body.episode,
    watched: body.watched,
    watchedAt: body.watchedAt
  })
  return { ok: true }
})
