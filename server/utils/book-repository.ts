import type { H3Event } from 'h3'
import { nextBookStatus } from '~~/core/application/books'
import type { BookAuthor, BookDashboard, BookLibraryItem, BookLibraryStatus, BookWork } from '~~/core/domain/books'
import type { BookRepository } from '~~/core/ports/book-repository'
import { encodeJson, getD1Database, nowIso, randomId } from './d1'

type BookWorkRow = {
  id: string
  openlibrary_work_key?: string | null
  google_volume_id?: string | null
  title: string
  subtitle?: string | null
  authors_json?: string | null
  description?: string | null
  cover_url?: string | null
  first_publish_year?: number | null
  subjects_json?: string | null
  source_payload_json?: string | null
  fetched_at?: string | null
  updated_at?: string | null
}

type BookLibraryRow = BookWorkRow & {
  user_id: string
  status: BookLibraryStatus
  favorite: number
  current_page?: number | null
  total_pages?: number | null
  current_percent?: number | null
  started_at?: string | null
  finished_at?: string | null
  added_at: string
  library_updated_at: string
}

export function getBookRepository(event: H3Event): BookRepository {
  const db = getD1Database(event)
  return db ? new D1BookRepository(db) : memoryBookRepository
}

class D1BookRepository implements BookRepository {
  constructor(private readonly db: D1Database) {}

  async searchCachedBooks(input: { query: string, limit: number }): Promise<BookWork[]> {
    const like = `%${input.query.trim()}%`
    const result = await this.db.prepare(`
      SELECT * FROM book_works
      WHERE title LIKE ?
      ORDER BY COALESCE(first_publish_year, 9999) ASC, title ASC
      LIMIT ?
    `).bind(like, input.limit).all<BookWorkRow>()

    return (result.results ?? []).map(mapBookWork)
  }

  async upsertBookWorks(works: BookWork[]): Promise<void> {
    if (works.length === 0) {
      return
    }

    await this.db.batch(works.map((work) => this.db.prepare(`
      INSERT INTO book_works (
        id, openlibrary_work_key, google_volume_id, title, subtitle, authors_json,
        description, cover_url, first_publish_year, subjects_json, source_payload_json,
        fetched_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        openlibrary_work_key = excluded.openlibrary_work_key,
        google_volume_id = excluded.google_volume_id,
        title = excluded.title,
        subtitle = COALESCE(excluded.subtitle, book_works.subtitle),
        authors_json = excluded.authors_json,
        description = COALESCE(excluded.description, book_works.description),
        cover_url = COALESCE(excluded.cover_url, book_works.cover_url),
        first_publish_year = COALESCE(excluded.first_publish_year, book_works.first_publish_year),
        subjects_json = COALESCE(excluded.subjects_json, book_works.subjects_json),
        source_payload_json = COALESCE(excluded.source_payload_json, book_works.source_payload_json),
        fetched_at = COALESCE(excluded.fetched_at, book_works.fetched_at),
        updated_at = excluded.updated_at
    `).bind(...bookWorkBindings(work))))
  }

  async getBookWork(id: string): Promise<BookWork | undefined> {
    const row = await this.db.prepare(`
      SELECT * FROM book_works
      WHERE id = ? OR openlibrary_work_key = ? OR google_volume_id = ?
    `).bind(id, id, id).first<BookWorkRow>()

    return row ? mapBookWork(row) : undefined
  }

  async getBookDashboard(userId: string): Promise<BookDashboard> {
    const [wantToRead, reading, read, paused, dnf, favorites] = await Promise.all([
      this.countBookLibrary(userId, 'want_to_read'),
      this.countBookLibrary(userId, 'reading'),
      this.countBookLibrary(userId, 'read'),
      this.countBookLibrary(userId, 'paused'),
      this.countBookLibrary(userId, 'dnf'),
      this.countBookFavorites(userId)
    ])

    return {
      summary: { wantToRead, reading, read, paused, dnf, favorites },
      currentlyReading: await this.getBookLibraryItems({ userId, status: 'reading' }),
      wantToRead: await this.getBookLibraryItems({ userId, status: 'want_to_read' }),
      recentlyRead: await this.getBookLibraryItems({ userId, status: 'read' })
    }
  }

  async getBookLibraryItems(input: { userId: string, status?: BookLibraryStatus }): Promise<BookLibraryItem[]> {
    const result = input.status
      ? await this.db.prepare(bookLibrarySelect('AND user_book_library_items.status = ?'))
        .bind(input.userId, input.status)
        .all<BookLibraryRow>()
      : await this.db.prepare(bookLibrarySelect(''))
        .bind(input.userId)
        .all<BookLibraryRow>()

    return (result.results ?? []).map(mapBookLibraryItem)
  }

  async upsertBookLibraryItem(input: {
    userId: string
    work: BookWork
    status: BookLibraryStatus
    favorite?: boolean
    currentPage?: number
    totalPages?: number
    currentPercent?: number
    startedAt?: string
    finishedAt?: string
  }): Promise<BookLibraryItem> {
    await this.upsertBookWorks([input.work])
    const now = nowIso()
    const finishedAt = input.finishedAt ?? (input.status === 'read' ? now : undefined)
    await this.db.prepare(`
      INSERT INTO user_book_library_items (
        user_id, work_id, status, favorite, current_page, total_pages, current_percent,
        started_at, finished_at, added_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, work_id) DO UPDATE SET
        status = excluded.status,
        favorite = CASE WHEN excluded.favorite = 1 THEN 1 ELSE user_book_library_items.favorite END,
        current_page = COALESCE(excluded.current_page, user_book_library_items.current_page),
        total_pages = COALESCE(excluded.total_pages, user_book_library_items.total_pages),
        current_percent = COALESCE(excluded.current_percent, user_book_library_items.current_percent),
        started_at = COALESCE(user_book_library_items.started_at, excluded.started_at),
        finished_at = COALESCE(excluded.finished_at, user_book_library_items.finished_at),
        updated_at = excluded.updated_at
    `).bind(
      input.userId,
      input.work.id,
      input.status,
      input.favorite ? 1 : 0,
      input.currentPage ?? null,
      input.totalPages ?? null,
      input.currentPercent ?? null,
      input.startedAt ?? (input.status === 'reading' ? now : null),
      finishedAt ?? null,
      now,
      now
    ).run()

    const row = await this.findBookLibraryItem(input.userId, input.work.id)
    if (!row) {
      throw new Error('Book library update failed.')
    }
    return row
  }

  async recordReadingProgress(input: {
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
  }): Promise<BookLibraryItem> {
    const status = nextBookStatus({
      currentPage: input.currentPage,
      totalPages: input.totalPages,
      currentPercent: input.currentPercent,
      explicitStatus: input.status
    })
    const item = await this.upsertBookLibraryItem({
      userId: input.userId,
      work: input.work,
      status,
      currentPage: input.currentPage,
      totalPages: input.totalPages,
      currentPercent: input.currentPercent,
      startedAt: status === 'reading' || status === 'read' ? input.recordedAt : undefined,
      finishedAt: status === 'read' ? input.recordedAt : undefined
    })

    if (input.pagesRead || input.minutesRead || input.note) {
      await this.db.prepare(`
        INSERT INTO reading_sessions (
          id, user_id, work_id, pages_read, minutes_read, started_at, ended_at, source, note
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        randomId('read'),
        input.userId,
        input.work.id,
        input.pagesRead ?? null,
        input.minutesRead ?? null,
        input.recordedAt,
        input.recordedAt,
        'manual',
        input.note ?? null
      ).run()
    }

    return item
  }

  private async countBookLibrary(userId: string, status: BookLibraryStatus): Promise<number> {
    const row = await this.db.prepare(`
      SELECT COUNT(*) AS count FROM user_book_library_items WHERE user_id = ? AND status = ?
    `).bind(userId, status).first<{ count: number }>()
    return row?.count ?? 0
  }

  private async countBookFavorites(userId: string): Promise<number> {
    const row = await this.db.prepare(`
      SELECT COUNT(*) AS count FROM user_book_library_items WHERE user_id = ? AND favorite = 1
    `).bind(userId).first<{ count: number }>()
    return row?.count ?? 0
  }

  private async findBookLibraryItem(userId: string, workId: string): Promise<BookLibraryItem | undefined> {
    const row = await this.db.prepare(bookLibrarySelect('AND user_book_library_items.work_id = ?', 1))
      .bind(userId, workId)
      .first<BookLibraryRow>()
    return row ? mapBookLibraryItem(row) : undefined
  }
}

class MemoryBookRepository implements BookRepository {
  private works = new Map<string, BookWork>()
  private library = new Map<string, BookLibraryItem>()

  async searchCachedBooks(input: { query: string, limit: number }): Promise<BookWork[]> {
    const query = input.query.toLowerCase()
    return [...this.works.values()]
      .filter((work) => work.title.toLowerCase().includes(query) || work.authors.some((author) => author.name.toLowerCase().includes(query)))
      .slice(0, input.limit)
  }

  async upsertBookWorks(works: BookWork[]): Promise<void> {
    for (const work of works) {
      this.works.set(work.id, { ...work, updatedAt: nowIso() })
    }
  }

  async getBookWork(id: string): Promise<BookWork | undefined> {
    return this.works.get(id)
  }

  async getBookDashboard(userId: string): Promise<BookDashboard> {
    const items = await this.getBookLibraryItems({ userId })
    return {
      summary: {
        wantToRead: items.filter((item) => item.status === 'want_to_read').length,
        reading: items.filter((item) => item.status === 'reading').length,
        read: items.filter((item) => item.status === 'read').length,
        paused: items.filter((item) => item.status === 'paused').length,
        dnf: items.filter((item) => item.status === 'dnf').length,
        favorites: items.filter((item) => item.favorite).length
      },
      currentlyReading: items.filter((item) => item.status === 'reading').slice(0, 12),
      wantToRead: items.filter((item) => item.status === 'want_to_read').slice(0, 12),
      recentlyRead: items.filter((item) => item.status === 'read').slice(0, 12)
    }
  }

  async getBookLibraryItems(input: { userId: string, status?: BookLibraryStatus }): Promise<BookLibraryItem[]> {
    return [...this.library.values()]
      .filter((item) => item.userId === input.userId && (!input.status || item.status === input.status))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async upsertBookLibraryItem(input: {
    userId: string
    work: BookWork
    status: BookLibraryStatus
    favorite?: boolean
    currentPage?: number
    totalPages?: number
    currentPercent?: number
    startedAt?: string
    finishedAt?: string
  }): Promise<BookLibraryItem> {
    await this.upsertBookWorks([input.work])
    const key = `${input.userId}:${input.work.id}`
    const existing = this.library.get(key)
    const now = nowIso()
    const item: BookLibraryItem = {
      userId: input.userId,
      work: input.work,
      status: input.status,
      favorite: Boolean(input.favorite ?? existing?.favorite),
      currentPage: input.currentPage ?? existing?.currentPage,
      totalPages: input.totalPages ?? existing?.totalPages,
      currentPercent: input.currentPercent ?? existing?.currentPercent,
      startedAt: existing?.startedAt ?? input.startedAt ?? (input.status === 'reading' ? now : undefined),
      finishedAt: input.finishedAt ?? existing?.finishedAt ?? (input.status === 'read' ? now : undefined),
      addedAt: existing?.addedAt ?? now,
      updatedAt: now
    }
    this.library.set(key, item)
    return item
  }

  async recordReadingProgress(input: {
    userId: string
    work: BookWork
    status?: BookLibraryStatus
    currentPage?: number
    totalPages?: number
    currentPercent?: number
    recordedAt: string
  }): Promise<BookLibraryItem> {
    return this.upsertBookLibraryItem({
      userId: input.userId,
      work: input.work,
      status: nextBookStatus({
        currentPage: input.currentPage,
        totalPages: input.totalPages,
        currentPercent: input.currentPercent,
        explicitStatus: input.status
      }),
      currentPage: input.currentPage,
      totalPages: input.totalPages,
      currentPercent: input.currentPercent,
      startedAt: input.recordedAt
    })
  }
}

const memoryBookRepository = new MemoryBookRepository()

function bookLibrarySelect(extraWhere: string, limit = 160): string {
  return `
    SELECT book_works.*, user_book_library_items.user_id, user_book_library_items.status,
      user_book_library_items.favorite, user_book_library_items.current_page,
      user_book_library_items.total_pages, user_book_library_items.current_percent,
      user_book_library_items.started_at, user_book_library_items.finished_at,
      user_book_library_items.added_at,
      user_book_library_items.updated_at AS library_updated_at
    FROM user_book_library_items
    INNER JOIN book_works ON book_works.id = user_book_library_items.work_id
    WHERE user_book_library_items.user_id = ?
    ${extraWhere}
    ORDER BY user_book_library_items.updated_at DESC
    LIMIT ${limit}
  `
}

function mapBookWork(row: BookWorkRow): BookWork {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    authors: parseBookAuthors(row.authors_json),
    description: row.description ?? undefined,
    coverUrl: row.cover_url ?? undefined,
    firstPublishYear: row.first_publish_year ?? undefined,
    subjects: parseStringArray(row.subjects_json),
    sourcePayload: row.source_payload_json ? JSON.parse(row.source_payload_json) : undefined,
    fetchedAt: row.fetched_at ?? undefined,
    updatedAt: row.updated_at ?? undefined
  }
}

function mapBookLibraryItem(row: BookLibraryRow): BookLibraryItem {
  return {
    userId: row.user_id,
    work: mapBookWork(row),
    status: row.status,
    favorite: Boolean(row.favorite),
    currentPage: row.current_page ?? undefined,
    totalPages: row.total_pages ?? undefined,
    currentPercent: row.current_percent ?? undefined,
    startedAt: row.started_at ?? undefined,
    finishedAt: row.finished_at ?? undefined,
    addedAt: row.added_at,
    updatedAt: row.library_updated_at
  }
}

function bookWorkBindings(work: BookWork): unknown[] {
  const source = extractBookSource(work)
  const now = nowIso()
  return [
    work.id,
    source.openLibraryWorkKey ?? null,
    source.googleVolumeId ?? null,
    work.title,
    work.subtitle ?? null,
    encodeJson(work.authors),
    work.description ?? null,
    work.coverUrl ?? null,
    work.firstPublishYear ?? null,
    encodeJson(work.subjects),
    work.sourcePayload ? encodeJson(work.sourcePayload) : null,
    work.fetchedAt ?? null,
    work.updatedAt ?? now
  ]
}

function extractBookSource(work: BookWork): { openLibraryWorkKey?: string, googleVolumeId?: string } {
  if (work.id.startsWith('ol-work-')) {
    return { openLibraryWorkKey: `/works/${work.id.replace(/^ol-work-/, '')}` }
  }
  if (work.id.startsWith('google-volume-')) {
    return { googleVolumeId: work.id.replace(/^google-volume-/, '') }
  }

  if (isRecord(work.sourcePayload)) {
    return {
      openLibraryWorkKey: typeof work.sourcePayload.workKey === 'string' ? work.sourcePayload.workKey : undefined,
      googleVolumeId: typeof work.sourcePayload.volumeId === 'string' ? work.sourcePayload.volumeId : undefined
    }
  }

  return {}
}

function parseStringArray(value: unknown): string[] {
  if (typeof value !== 'string' || value.trim() === '') {
    return []
  }

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function parseBookAuthors(value: unknown): BookAuthor[] {
  if (typeof value !== 'string' || value.trim() === '') {
    return []
  }

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed
      .filter(isRecord)
      .map((item) => ({
        id: typeof item.id === 'string' ? item.id : '',
        name: typeof item.name === 'string' ? item.name : ''
      }))
      .filter((author) => author.name)
  } catch {
    return []
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
