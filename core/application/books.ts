import type { BookLibraryStatus, BookWork } from '../domain/books'
import type { BookCatalogProvider } from '../ports/book-catalog-provider'
import type { BookRepository } from '../ports/book-repository'

export async function searchBooks(input: {
  query: string
  limit?: number
  provider: BookCatalogProvider
  repository: BookRepository
}): Promise<BookWork[]> {
  const query = input.query.trim()
  if (query.length < 2) {
    return []
  }

  const limit = Math.min(Math.max(input.limit ?? 12, 1), 30)
  const providerResults = await input.provider.search({ query, limit })
  if (providerResults.length > 0) {
    await input.repository.upsertBookWorks(providerResults)
    return providerResults
  }

  return input.repository.searchCachedBooks({ query, limit })
}

export async function getBook(input: {
  id: string
  provider: BookCatalogProvider
  repository: BookRepository
}): Promise<BookWork | undefined> {
  const book = await input.provider.getBook(input.id)
  if (book) {
    await input.repository.upsertBookWorks([book])
    return book
  }

  return input.repository.getBookWork(input.id)
}

export async function getRelatedBooks(input: {
  id: string
  provider: BookCatalogProvider
  repository: BookRepository
  limit?: number
}): Promise<BookWork[]> {
  const book = await getBook(input)
  if (!book) {
    return []
  }

  const limit = Math.min(Math.max(input.limit ?? 12, 1), 24)
  const related = await input.provider.getRelatedBooks({ book, limit })
  if (related.length > 0) {
    await input.repository.upsertBookWorks(related)
    return related
  }

  return []
}

export function nextBookStatus(input: {
  currentPage?: number
  totalPages?: number
  currentPercent?: number
  explicitStatus?: BookLibraryStatus
}): BookLibraryStatus {
  if (input.explicitStatus) {
    return input.explicitStatus
  }
  if (input.currentPercent !== undefined && input.currentPercent >= 100) {
    return 'read'
  }
  if (input.totalPages && input.currentPage !== undefined && input.currentPage >= input.totalPages) {
    return 'read'
  }
  if ((input.currentPage ?? 0) > 0 || (input.currentPercent ?? 0) > 0) {
    return 'reading'
  }
  return 'want_to_read'
}
