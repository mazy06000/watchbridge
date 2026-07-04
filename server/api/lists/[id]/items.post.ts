import { z } from 'zod'
import { requireUser } from '~~/server/utils/auth'
import { getTrackerRepository } from '~~/server/utils/tracker-repository'

const bodySchema = z.object({
  title: z.object({
    id: z.string().min(1),
    imdbId: z.string().optional(),
    type: z.enum(['movie', 'series']),
    primaryTitle: z.string().min(1),
    originalTitle: z.string().optional(),
    primaryImageUrl: z.string().optional(),
    startYear: z.number().int().optional(),
    endYear: z.number().int().optional(),
    runtimeSeconds: z.number().int().optional(),
    plot: z.string().optional(),
    ratingAverage: z.number().optional(),
    ratingCount: z.number().int().optional(),
    genres: z.array(z.string()).default([]),
    nextRelease: z.object({
      kind: z.enum(['movie', 'episode']),
      title: z.string().optional(),
      date: z.string().optional(),
      seasonNumber: z.number().int().optional(),
      episodeNumber: z.number().int().optional(),
      source: z.string()
    }).optional()
  })
})

export default defineEventHandler(async (event) => {
  setNoStoreHeaders(event)
  const user = await requireUser(event)
  const body = bodySchema.parse(await readBody(event))
  await getTrackerRepository(event).addTitleToList({
    userId: user.id,
    listId: getRouterParam(event, 'id') ?? '',
    title: body.title
  })
  return { ok: true }
})
