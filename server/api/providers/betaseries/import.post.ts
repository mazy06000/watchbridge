import { z } from 'zod'
import { importToBetaSeries } from '~~/server/utils/betaseries-provider'

const schema = z.object({
  accessToken: z.string().min(8),
  operations: z.array(z.object({
    operationId: z.string().min(1),
    kind: z.enum(['episode-watched', 'show-library', 'movie-watched', 'movie-list']),
    providerId: z.string().min(1),
    state: z.enum(['followed', 'watchlist', 'watched']).optional()
  })).min(1).max(50)
})

export default defineEventHandler(async (event) => {
  setNoStoreHeaders(event)

  const body = schema.parse(await readBody(event))
  return {
    results: await importToBetaSeries(event, body.accessToken, body.operations)
  }
})
