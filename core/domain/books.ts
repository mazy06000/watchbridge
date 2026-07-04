export type BookLibraryStatus = 'want_to_read' | 'reading' | 'read' | 'paused' | 'dnf'

export interface BookAuthor {
  id: string
  name: string
}

export interface BookWork {
  id: string
  title: string
  subtitle?: string
  authors: BookAuthor[]
  description?: string
  coverUrl?: string
  firstPublishYear?: number
  subjects: string[]
  sourcePayload?: unknown
  fetchedAt?: string
  updatedAt?: string
}

export interface BookEdition {
  id: string
  workId: string
  title: string
  isbn10?: string
  isbn13?: string
  publisher?: string
  publishedDate?: string
  pageCount?: number
  language?: string
  sourcePayload?: unknown
  fetchedAt?: string
  updatedAt?: string
}

export interface BookLibraryItem {
  userId: string
  work: BookWork
  status: BookLibraryStatus
  favorite: boolean
  currentPage?: number
  totalPages?: number
  currentPercent?: number
  startedAt?: string
  finishedAt?: string
  addedAt: string
  updatedAt: string
}

export interface ReadingSession {
  id: string
  userId: string
  workId: string
  editionId?: string
  pagesRead?: number
  minutesRead?: number
  startedAt: string
  endedAt?: string
  source: 'manual' | 'import' | 'provider'
  note?: string
  createdAt: string
}

export interface BookLibrarySummary {
  wantToRead: number
  reading: number
  read: number
  paused: number
  dnf: number
  favorites: number
}

export interface BookDashboard {
  summary: BookLibrarySummary
  currentlyReading: BookLibraryItem[]
  wantToRead: BookLibraryItem[]
  recentlyRead: BookLibraryItem[]
}

export function bookWorkIdFromOpenLibraryKey(workKey: string): string {
  return `ol-work-${workKey.replace(/^\/?works\//, '')}`
}

export function bookWorkIdFromGoogleVolumeId(volumeId: string): string {
  return `google-volume-${volumeId}`
}
