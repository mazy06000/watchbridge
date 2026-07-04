import { z } from 'zod'
import { requireUser } from '~~/server/utils/auth'
import { getTrackerRepository } from '~~/server/utils/tracker-repository'

const bodySchema = z.object({
  totalItems: z.number().int().min(0)
})

export default defineEventHandler(async (event) => {
  setNoStoreHeaders(event)
  const user = await requireUser(event)
  const body = bodySchema.parse(await readBody(event))
  const job = await getTrackerRepository(event).createImportJob({
    userId: user.id,
    source: 'tvtime-gdpr',
    totalItems: body.totalItems
  })
  return { job }
})
