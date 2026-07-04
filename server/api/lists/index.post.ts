import { z } from 'zod'
import { requireUser } from '~~/server/utils/auth'
import { getTrackerRepository } from '~~/server/utils/tracker-repository'

const bodySchema = z.object({
  name: z.string().min(1).max(80),
  kind: z.enum(['custom', 'watchlist', 'favorites']).default('custom')
})

export default defineEventHandler(async (event) => {
  setNoStoreHeaders(event)
  const user = await requireUser(event)
  const body = bodySchema.parse(await readBody(event))
  const list = await getTrackerRepository(event).createList({ userId: user.id, ...body })
  return { list }
})
