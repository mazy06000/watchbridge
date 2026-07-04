import { z } from 'zod'
import { requireUser } from '~~/server/utils/auth'
import { getTrackerRepository } from '~~/server/utils/tracker-repository'

const bodySchema = z.object({
  titleId: z.string().optional(),
  episodeId: z.string().optional(),
  watchedAt: z.string().datetime().optional(),
  source: z.enum(['manual', 'import', 'provider']).default('manual'),
  sourceEventKey: z.string().optional()
})

export default defineEventHandler(async (event) => {
  setNoStoreHeaders(event)
  const user = await requireUser(event)
  const body = bodySchema.parse(await readBody(event))
  await getTrackerRepository(event).addWatchEvent({
    userId: user.id,
    titleId: body.titleId,
    episodeId: body.episodeId,
    watchedAt: body.watchedAt ?? new Date().toISOString(),
    source: body.source,
    sourceEventKey: body.sourceEventKey
  })
  return { ok: true }
})
