import type { CatalogTitle, CatalogTitleType } from '../domain/tracker'

export interface CatalogSearchInput {
  query: string
  type?: CatalogTitleType | 'all'
  limit?: number
}

export interface CatalogProvider {
  search(input: CatalogSearchInput): Promise<CatalogTitle[]>
  getTitle(id: string): Promise<CatalogTitle | undefined>
}
