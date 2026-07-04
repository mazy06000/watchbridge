import { z } from 'zod'
import { requireUser } from '~~/server/utils/auth'
import { getTrackerRepository } from '~~/server/utils/tracker-repository'

const querySchema = z.object({
  status: z.enum(['watchlist', 'watching', 'completed', 'paused', 'dropped']).optional()
})

export default defineEventHandler(async (event) => {
  setNoStoreHeaders(event)
  const user = await requireUser(event)
  const query = querySchema.parse(getQuery(event))
  const repository = getTrackerRepository(event)
  const [dashboard, items] = await Promise.all([
    repository.getDashboard(user.id),
    repository.getLibraryItems({ userId: user.id, status: query.status })
  ])

  return { dashboard, items }
})
