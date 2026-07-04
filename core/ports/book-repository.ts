import type { BookDashboard, BookLibraryItem, BookLibraryStatus, BookWork } from '../domain/books'

export interface BookRepository {
  searchCachedBooks(input: { query: string, limit: number }): Promise<BookWork[]>
  upsertBookWorks(works: BookWork[]): Promise<void>
  getBookWork(id: string): Promise<BookWork | undefined>
  getBookDashboard(userId: string): Promise<BookDashboard>
  getBookLibraryItems(input: { userId: string, status?: BookLibraryStatus }): Promise<BookLibraryItem[]>
  upsertBookLibraryItem(input: {
    userId: string
    work: BookWork
    status: BookLibraryStatus
    favorite?: boolean
    currentPage?: number
    totalPages?: number
    currentPercent?: number
    startedAt?: string
    finishedAt?: string
  }): Promise<BookLibraryItem>
  recordReadingProgress(input: {
    userId: string
    work: BookWork
    status?: BookLibraryStatus
    currentPage?: number
    totalPages?: number
    currentPercent?: number
    pagesRead?: number
    minutesRead?: number
    note?: string
    recordedAt: string
  }): Promise<BookLibraryItem>
}
