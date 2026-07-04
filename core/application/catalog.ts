import type { CatalogProvider } from '../ports/catalog-provider'
import type { TrackerRepository } from '../ports/tracker-repository'
import type { CatalogTitle, CatalogTitleType } from '../domain/tracker'

export async function searchCatalog(input: {
  query: string
  type?: CatalogTitleType | 'all'
  limit?: number
  provider: CatalogProvider
  repository: TrackerRepository
}): Promise<CatalogTitle[]> {
  const query = input.query.trim()
  if (query.length < 2) {
    return []
  }

  const limit = Math.min(Math.max(input.limit ?? 12, 1), 30)
  const providerResults = await input.provider.search({ query, type: input.type ?? 'all', limit })

  if (providerResults.length > 0) {
    await input.repository.upsertCatalogTitles(providerResults)
    return providerResults
  }

  return input.repository.searchCachedTitles({ query, type: input.type ?? 'all', limit })
}

export async function getCatalogTitle(input: {
  id: string
  provider: CatalogProvider
  repository: TrackerRepository
}): Promise<CatalogTitle | undefined> {
  const title = await input.provider.getTitle(input.id)
  if (title) {
    await input.repository.upsertCatalogTitles([title])
    return title
  }

  return input.repository.getCatalogTitle(input.id)
}
