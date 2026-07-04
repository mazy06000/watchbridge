import { requireUser } from '~~/server/utils/auth'
import { getTrackerRepository } from '~~/server/utils/tracker-repository'

export default defineEventHandler(async (event) => {
  setNoStoreHeaders(event)
  const user = await requireUser(event)
  return { lists: await getTrackerRepository(event).listLists(user.id) }
})
