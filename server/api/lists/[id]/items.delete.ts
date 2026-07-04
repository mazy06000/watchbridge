import { z } from 'zod'
import { requireUser } from '~~/server/utils/auth'
import { getTrackerRepository } from '~~/server/utils/tracker-repository'

const bodySchema = z.object({
  titleId: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  setNoStoreHeaders(event)
  const user = await requireUser(event)
  const body = bodySchema.parse(await readBody(event))
  await getTrackerRepository(event).removeTitleFromList({
    userId: user.id,
    listId: getRouterParam(event, 'id') ?? '',
    titleId: body.titleId
  })
  return { ok: true }
})
