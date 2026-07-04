import type { BookWork } from '../domain/books'

export interface BookSearchInput {
  query: string
  limit?: number
}

export interface BookCatalogProvider {
  search(input: BookSearchInput): Promise<BookWork[]>
  getBook(id: string): Promise<BookWork | undefined>
  getRelatedBooks(input: { book: BookWork, limit?: number }): Promise<BookWork[]>
}
