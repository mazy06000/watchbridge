import { z } from 'zod'
import { requireUser } from '~~/server/utils/auth'

const bodySchema = z.object({
  items: z.array(z.unknown()).max(250)
})

export default defineEventHandler(async (event) => {
  setNoStoreHeaders(event)
  await requireUser(event)
  const body = bodySchema.parse(await readBody(event))
  return {
    ok: true,
    accepted: body.items.length,
    jobId: getRouterParam(event, 'jobId')
  }
})
