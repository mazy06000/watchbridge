import { z } from 'zod'
import { requireUser } from '~~/server/utils/auth'
import { getTrackerRepository } from '~~/server/utils/tracker-repository'

const bodySchema = z.object({
  name: z.string().min(1).max(80)
})

export default defineEventHandler(async (event) => {
  setNoStoreHeaders(event)
  const user = await requireUser(event)
  const body = bodySchema.parse(await readBody(event))
  await getTrackerRepository(event).updateList({
    userId: user.id,
    listId: getRouterParam(event, 'id') ?? '',
    name: body.name
  })
  return { ok: true }
})
