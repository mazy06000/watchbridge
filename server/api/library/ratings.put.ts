import { z } from 'zod'
import { requireUser } from '~~/server/utils/auth'
import { getTrackerRepository } from '~~/server/utils/tracker-repository'

const bodySchema = z.object({
  titleId: z.string().optional(),
  episodeId: z.string().optional(),
  rating10: z.number().int().min(1).max(10),
  reviewText: z.string().max(4000).optional()
})

export default defineEventHandler(async (event) => {
  setNoStoreHeaders(event)
  const user = await requireUser(event)
  const body = bodySchema.parse(await readBody(event))
  await getTrackerRepository(event).setRating({ userId: user.id, ...body })
  return { ok: true }
})
