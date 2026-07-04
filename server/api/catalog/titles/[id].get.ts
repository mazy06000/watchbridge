import { getCatalogTitle } from '~~/core/application/catalog'
import { createTmdbCatalogProvider } from '~~/server/utils/tmdb-catalog-provider'
import { getTrackerRepository } from '~~/server/utils/tracker-repository'

export default defineEventHandler(async (event) => {
  setNoStoreHeaders(event)
  const id = getRouterParam(event, 'id') ?? ''
  const config = useRuntimeConfig(event)
  const title = await getCatalogTitle({
    id,
    provider: createTmdbCatalogProvider({
      accessToken: config.tmdbAccessToken,
      apiKey: config.tmdbApiKey
    }),
    repository: getTrackerRepository(event)
  })

  if (!title) {
    throw jsonError(404, 'Title not found.')
  }

  return { title }
})
