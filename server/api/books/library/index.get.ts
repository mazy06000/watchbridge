import { z } from 'zod'
import { requireUser } from '~~/server/utils/auth'
import { getBookRepository } from '~~/server/utils/book-repository'
import { bookStatusSchema } from '~~/server/utils/book-schema'

const querySchema = z.object({
  status: bookStatusSchema.optional()
})

export default defineEventHandler(async (event) => {
  setNoStoreHeaders(event)
  const user = await requireUser(event)
  const query = querySchema.parse(getQuery(event))
  const repository = getBookRepository(event)
  const [dashboard, items] = await Promise.all([
    repository.getBookDashboard(user.id),
    repository.getBookLibraryItems({ userId: user.id, status: query.status })
  ])

  return { dashboard, items }
})
