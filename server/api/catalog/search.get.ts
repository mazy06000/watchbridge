import { z } from 'zod'
import { searchCatalog } from '~~/core/application/catalog'
import { createTmdbCatalogProvider } from '~~/server/utils/tmdb-catalog-provider'
import { getTrackerRepository } from '~~/server/utils/tracker-repository'

const querySchema = z.object({
  q: z.string().default(''),
  type: z.enum(['all', 'movie', 'series']).default('all'),
  limit: z.coerce.number().int().min(1).max(30).default(12)
})

export default defineEventHandler(async (event) => {
  setNoStoreHeaders(event)
  const query = querySchema.parse(getQuery(event))
  const config = useRuntimeConfig(event)
  const results = await searchCatalog({
    query: query.q,
    type: query.type,
    limit: query.limit,
    provider: createTmdbCatalogProvider({
      accessToken: config.tmdbAccessToken,
      apiKey: config.tmdbApiKey
    }),
    repository: getTrackerRepository(event)
  })

  return { results }
})
