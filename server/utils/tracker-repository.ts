import type { H3Event } from 'h3'
import type { NormalizedLibrary, WatchedEpisode } from '~~/core/domain/media'
import { stableMediaId } from '~~/core/domain/media'
import {
  catalogTitleId,
  slugifyTitle,
  type CatalogEpisode,
  type CatalogTitle,
  type ImportCommitResult,
  type ImportJob,
  type LibraryItem,
  type LibraryStatus,
  type TrackerDashboard,
  type UserAccount
} from '~~/core/domain/tracker'
import type {
  AuthRepository,
  CreateMagicLinkInput,
  TrackerRepository
} from '~~/core/ports/tracker-repository'
import { encodeJson, getD1Database, nowIso, parseJsonArray, randomId } from './d1'

type TitleRow = {
  id: string
  imdb_id?: string | null
  type: 'movie' | 'series'
  primary_title: string
  original_title?: string | null
  primary_image_url?: string | null
  start_year?: number | null
  end_year?: number | null
  runtime_seconds?: number | null
  plot?: string | null
  rating_average?: number | null
  rating_count?: number | null
  genres_json?: string | null
  next_release_type?: 'movie' | 'episode' | null
  next_release_title?: string | null
  next_release_date?: string | null
  next_release_season_number?: number | null
  next_release_episode_number?: number | null
  next_release_source?: string | null
  source_payload_json?: string | null
  fetched_at?: string | null
  updated_at?: string | null
}

type LibraryRow = TitleRow & {
  user_id: string
  status: LibraryStatus
  favorite: number
  added_at: string
  library_updated_at: string
}

type UserRow = {
  id: string
  email: string
  display_name?: string | null
  avatar_url?: string | null
  created_at: string
  updated_at: string
  last_login_at?: string | null
}

type ImportJobRow = {
  id: string
  user_id: string
  source: NormalizedLibrary['source']
  status: ImportJob['status']
  total_items: number
  imported_items: number
  failed_items: number
  created_at: string
  completed_at?: string | null
}

export function getAuthRepository(event: H3Event): AuthRepository {
  const db = getD1Database(event)
  return db ? new D1TrackerRepository(db) : memoryRepository
}

export function getTrackerRepository(event: H3Event): TrackerRepository {
  const db = getD1Database(event)
  return db ? new D1TrackerRepository(db) : memoryRepository
}

class D1TrackerRepository implements AuthRepository, TrackerRepository {
  constructor(private readonly db: D1Database) {}

  async createMagicLink(input: CreateMagicLinkInput): Promise<void> {
    await this.db.prepare(`
      INSERT INTO auth_magic_links (id, email, token_hash, expires_at)
      VALUES (?, ?, ?, ?)
    `).bind(input.id, input.email, input.tokenHash, input.expiresAt).run()
  }

  async consumeMagicLink(tokenHash: string, now: string): Promise<{ email: string } | undefined> {
    const row = await this.db.prepare(`
      SELECT email FROM auth_magic_links
      WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?
    `).bind(tokenHash, now).first<{ email: string }>()

    if (!row) {
      return undefined
    }

    await this.db.prepare('UPDATE auth_magic_links SET used_at = ? WHERE token_hash = ?')
      .bind(now, tokenHash)
      .run()
    return { email: row.email }
  }

  async upsertUserByEmail(input: { id: string, email: string, displayName?: string, now: string }): Promise<UserAccount> {
    await this.db.prepare(`
      INSERT INTO users (id, email, display_name, created_at, updated_at, last_login_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET
        display_name = COALESCE(users.display_name, excluded.display_name),
        updated_at = excluded.updated_at,
        last_login_at = excluded.last_login_at
    `).bind(input.id, input.email, input.displayName ?? null, input.now, input.now, input.now).run()

    const row = await this.db.prepare('SELECT * FROM users WHERE email = ?')
      .bind(input.email)
      .first<UserRow>()

    if (!row) {
      throw new Error('User creation failed.')
    }
    return mapUser(row)
  }

  async createSession(input: { id: string, userId: string, tokenHash: string, expiresAt: string, now: string }): Promise<void> {
    await this.db.prepare(`
      INSERT INTO auth_sessions (id, user_id, token_hash, expires_at, created_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(input.id, input.userId, input.tokenHash, input.expiresAt, input.now, input.now).run()
  }

  async findUserBySessionHash(tokenHash: string, now: string): Promise<UserAccount | undefined> {
    const row = await this.db.prepare(`
      SELECT users.*
      FROM auth_sessions
      INNER JOIN users ON users.id = auth_sessions.user_id
      WHERE auth_sessions.token_hash = ? AND auth_sessions.expires_at > ?
    `).bind(tokenHash, now).first<UserRow>()

    if (!row) {
      return undefined
    }

    await this.db.prepare('UPDATE auth_sessions SET last_seen_at = ? WHERE token_hash = ?')
      .bind(now, tokenHash)
      .run()
    return mapUser(row)
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await this.db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?')
      .bind(tokenHash)
      .run()
  }

  async searchCachedTitles(input: { query: string, type?: 'movie' | 'series' | 'all', limit: number }): Promise<CatalogTitle[]> {
    const like = `%${input.query.trim()}%`
    const result = input.type && input.type !== 'all'
      ? await this.db.prepare(`
          SELECT * FROM catalog_titles
          WHERE type = ? AND primary_title LIKE ?
          ORDER BY COALESCE(rating_count, 0) DESC, primary_title ASC
          LIMIT ?
        `).bind(input.type, like, input.limit).all<TitleRow>()
      : await this.db.prepare(`
          SELECT * FROM catalog_titles
          WHERE primary_title LIKE ?
          ORDER BY COALESCE(rating_count, 0) DESC, primary_title ASC
          LIMIT ?
        `).bind(like, input.limit).all<TitleRow>()

    return (result.results ?? []).map(mapTitle)
  }

  async upsertCatalogTitles(titles: CatalogTitle[]): Promise<void> {
    if (titles.length === 0) {
      return
    }

    await this.db.batch(titles.map((title) => this.db.prepare(`
      INSERT INTO catalog_titles (
        id, imdb_id, type, primary_title, original_title, primary_image_url, start_year,
        end_year, runtime_seconds, plot, rating_average, rating_count, genres_json,
        next_release_type, next_release_title, next_release_date, next_release_season_number,
        next_release_episode_number, next_release_source, source_payload_json, fetched_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        imdb_id = excluded.imdb_id,
        type = excluded.type,
        primary_title = excluded.primary_title,
        original_title = excluded.original_title,
        primary_image_url = excluded.primary_image_url,
        start_year = excluded.start_year,
        end_year = excluded.end_year,
        runtime_seconds = excluded.runtime_seconds,
        plot = excluded.plot,
        rating_average = excluded.rating_average,
        rating_count = excluded.rating_count,
        genres_json = excluded.genres_json,
        next_release_type = excluded.next_release_type,
        next_release_title = excluded.next_release_title,
        next_release_date = excluded.next_release_date,
        next_release_season_number = excluded.next_release_season_number,
        next_release_episode_number = excluded.next_release_episode_number,
        next_release_source = excluded.next_release_source,
        source_payload_json = excluded.source_payload_json,
        fetched_at = excluded.fetched_at,
        updated_at = excluded.updated_at
    `).bind(...titleBindings(title))))
  }

  async getCatalogTitle(id: string): Promise<CatalogTitle | undefined> {
    const row = await this.db.prepare('SELECT * FROM catalog_titles WHERE id = ? OR imdb_id = ?')
      .bind(id, id)
      .first<TitleRow>()
    return row ? mapTitle(row) : undefined
  }

  async upsertCatalogEpisode(episode: CatalogEpisode): Promise<void> {
    await this.db.prepare(`
      INSERT INTO catalog_episodes (
        id, imdb_id, series_title_id, season_number, episode_number, primary_title,
        air_date, runtime_seconds, plot, fetched_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        imdb_id = excluded.imdb_id,
        series_title_id = excluded.series_title_id,
        season_number = excluded.season_number,
        episode_number = excluded.episode_number,
        primary_title = excluded.primary_title,
        air_date = excluded.air_date,
        runtime_seconds = excluded.runtime_seconds,
        plot = excluded.plot,
        fetched_at = excluded.fetched_at,
        updated_at = excluded.updated_at
    `).bind(
      episode.id,
      episode.imdbId ?? null,
      episode.seriesTitleId,
      episode.seasonNumber,
      episode.episodeNumber,
      episode.primaryTitle,
      episode.airDate ?? null,
      episode.runtimeSeconds ?? null,
      episode.plot ?? null,
      episode.fetchedAt ?? null,
      nowIso()
    ).run()
  }

  async getDashboard(userId: string): Promise<TrackerDashboard> {
    const [watching, watchlist, completed, paused, dropped, favorites] = await Promise.all([
      this.countLibrary(userId, 'watching'),
      this.countLibrary(userId, 'watchlist'),
      this.countLibrary(userId, 'completed'),
      this.countLibrary(userId, 'paused'),
      this.countLibrary(userId, 'dropped'),
      this.countFavorites(userId)
    ])

    return {
      summary: { watching, watchlist, completed, paused, dropped, favorites },
      continueWatching: await this.getLibraryItems({ userId, status: 'watching' }),
      watchlist: await this.getLibraryItems({ userId, status: 'watchlist' }),
      recentlyWatched: []
    }
  }

  async getLibraryItems(input: { userId: string, status?: LibraryStatus }): Promise<LibraryItem[]> {
    const result = input.status
      ? await this.db.prepare(`
          SELECT catalog_titles.*, user_library_items.user_id, user_library_items.status,
            user_library_items.favorite, user_library_items.added_at,
            user_library_items.updated_at AS library_updated_at
          FROM user_library_items
          INNER JOIN catalog_titles ON catalog_titles.id = user_library_items.title_id
          WHERE user_library_items.user_id = ? AND user_library_items.status = ?
          ORDER BY user_library_items.updated_at DESC
          LIMIT 80
        `).bind(input.userId, input.status).all<LibraryRow>()
      : await this.db.prepare(`
          SELECT catalog_titles.*, user_library_items.user_id, user_library_items.status,
            user_library_items.favorite, user_library_items.added_at,
            user_library_items.updated_at AS library_updated_at
          FROM user_library_items
          INNER JOIN catalog_titles ON catalog_titles.id = user_library_items.title_id
          WHERE user_library_items.user_id = ?
          ORDER BY user_library_items.updated_at DESC
          LIMIT 160
        `).bind(input.userId).all<LibraryRow>()

    return (result.results ?? []).map(mapLibraryItem)
  }

  async upsertLibraryItem(input: { userId: string, title: CatalogTitle, status: LibraryStatus, favorite?: boolean }): Promise<LibraryItem> {
    await this.upsertCatalogTitles([input.title])
    const now = nowIso()
    await this.db.prepare(`
      INSERT INTO user_library_items (user_id, title_id, status, favorite, added_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, title_id) DO UPDATE SET
        status = excluded.status,
        favorite = CASE WHEN excluded.favorite = 1 THEN 1 ELSE user_library_items.favorite END,
        updated_at = excluded.updated_at
    `).bind(input.userId, input.title.id, input.status, input.favorite ? 1 : 0, now, now).run()

    return {
      userId: input.userId,
      title: input.title,
      status: input.status,
      favorite: Boolean(input.favorite),
      addedAt: now,
      updatedAt: now
    }
  }

  async addWatchEvent(input: { userId: string, titleId?: string, episodeId?: string, watchedAt: string, source: 'manual' | 'import' | 'provider', sourceEventKey?: string }): Promise<void> {
    await this.db.prepare(`
      INSERT OR IGNORE INTO watch_events (id, user_id, title_id, episode_id, watched_at, source, source_event_key)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      randomId('watch'),
      input.userId,
      input.titleId ?? null,
      input.episodeId ?? null,
      input.watchedAt,
      input.source,
      input.sourceEventKey ?? null
    ).run()
  }

  async setEpisodeProgress(input: { userId: string, episode: CatalogEpisode, watched: boolean, watchedAt?: string }): Promise<void> {
    await this.upsertCatalogEpisode(input.episode)
    await this.db.prepare(`
      INSERT INTO user_episode_progress (user_id, episode_id, progress_state, watched_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, episode_id) DO UPDATE SET
        progress_state = excluded.progress_state,
        watched_at = excluded.watched_at,
        updated_at = excluded.updated_at
    `).bind(
      input.userId,
      input.episode.id,
      input.watched ? 'watched' : 'unwatched',
      input.watchedAt ?? null,
      nowIso()
    ).run()
  }

  async setRating(input: { userId: string, titleId?: string, episodeId?: string, rating10: number, reviewText?: string }): Promise<void> {
    await this.db.prepare(`
      INSERT INTO user_ratings (id, user_id, title_id, episode_id, rating_10, review_text, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, title_id, episode_id) DO UPDATE SET
        rating_10 = excluded.rating_10,
        review_text = excluded.review_text,
        updated_at = excluded.updated_at
    `).bind(
      randomId('rating'),
      input.userId,
      input.titleId ?? null,
      input.episodeId ?? null,
      input.rating10,
      input.reviewText ?? null,
      nowIso()
    ).run()
  }

  async createList(input: { userId: string, name: string, kind: 'custom' | 'watchlist' | 'favorites' }) {
    const id = randomId('list')
    const slug = slugifyTitle(input.name)
    await this.db.prepare(`
      INSERT INTO user_lists (id, user_id, name, slug, kind)
      VALUES (?, ?, ?, ?, ?)
    `).bind(id, input.userId, input.name, slug, input.kind).run()
    return { id, name: input.name, slug, kind: input.kind }
  }

  async listLists(userId: string) {
    const result = await this.db.prepare(`
      SELECT id, name, slug, kind FROM user_lists WHERE user_id = ? ORDER BY updated_at DESC
    `).bind(userId).all<{ id: string, name: string, slug: string, kind: string }>()
    return result.results ?? []
  }

  async updateList(input: { userId: string, listId: string, name: string }): Promise<void> {
    await this.db.prepare(`
      UPDATE user_lists SET name = ?, slug = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).bind(input.name, slugifyTitle(input.name), nowIso(), input.listId, input.userId).run()
  }

  async addTitleToList(input: { userId: string, listId: string, title: CatalogTitle }): Promise<void> {
    await this.upsertCatalogTitles([input.title])
    await this.db.prepare(`
      INSERT OR IGNORE INTO user_list_items (list_id, title_id, position)
      SELECT ?, ?, COALESCE(MAX(position), 0) + 1 FROM user_list_items WHERE list_id = ?
    `).bind(input.listId, input.title.id, input.listId).run()
  }

  async removeTitleFromList(input: { userId: string, listId: string, titleId: string }): Promise<void> {
    await this.db.prepare(`
      DELETE FROM user_list_items
      WHERE list_id = ? AND title_id = ? AND EXISTS (
        SELECT 1 FROM user_lists WHERE user_lists.id = ? AND user_lists.user_id = ?
      )
    `).bind(input.listId, input.titleId, input.listId, input.userId).run()
  }

  async createImportJob(input: { userId: string, source: NormalizedLibrary['source'], totalItems: number }): Promise<ImportJob> {
    const job: ImportJob = {
      id: randomId('import'),
      userId: input.userId,
      source: input.source,
      status: 'preview',
      totalItems: input.totalItems,
      importedItems: 0,
      failedItems: 0,
      createdAt: nowIso()
    }

    await this.db.prepare(`
      INSERT INTO import_jobs (id, user_id, source, status, total_items, imported_items, failed_items, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(job.id, job.userId, job.source, job.status, job.totalItems, 0, 0, job.createdAt).run()
    return job
  }

  async commitTvTimeImport(input: { userId: string, jobId: string, library: NormalizedLibrary }): Promise<ImportCommitResult> {
    const now = nowIso()
    let importedItems = 0
    let skippedItems = 0

    await this.db.prepare('UPDATE import_jobs SET status = ? WHERE id = ? AND user_id = ?')
      .bind('running', input.jobId, input.userId)
      .run()

    for (const title of buildImportedTitles(input.library)) {
      await this.upsertCatalogTitles([title])
    }

    for (const show of input.library.shows) {
      const title = titleFromShow(show.title, show.source.showId ?? show.id)
      await this.upsertLibraryItem({
        userId: input.userId,
        title,
        status: show.archived ? 'dropped' : show.episodeCountSeen ? 'watching' : 'watchlist',
        favorite: show.favorited
      })
      importedItems += 1
    }

    for (const episode of input.library.watchedEpisodes) {
      const showTitle = titleFromEpisode(episode)
      await this.upsertLibraryItem({ userId: input.userId, title: showTitle, status: 'watching' })
      const catalogEpisode = episodeFromTvTime(episode, showTitle.id)
      await this.setEpisodeProgress({
        userId: input.userId,
        episode: catalogEpisode,
        watched: true,
        watchedAt: episode.watchedAt
      })
      await this.addWatchEvent({
        userId: input.userId,
        titleId: showTitle.id,
        episodeId: catalogEpisode.id,
        watchedAt: episode.watchedAt ?? now,
        source: 'import',
        sourceEventKey: `tvtime:${episode.id}:${episode.watchedAt ?? 'unknown'}`
      })
      importedItems += 1
    }

    for (const movie of input.library.watchedMovies) {
      const title = titleFromMovie(movie.title, movie.source.movieId ?? movie.id, movie.releaseDate)
      await this.upsertLibraryItem({ userId: input.userId, title, status: 'completed' })
      await this.addWatchEvent({
        userId: input.userId,
        titleId: title.id,
        watchedAt: movie.watchedAt ?? now,
        source: 'import',
        sourceEventKey: `tvtime:${movie.id}:${movie.watchedAt ?? 'unknown'}`
      })
      importedItems += 1
    }

    for (const movie of input.library.movieList) {
      const title = titleFromMovie(movie.title, movie.source.movieId ?? movie.id, movie.releaseDate)
      await this.upsertLibraryItem({ userId: input.userId, title, status: 'watchlist' })
      importedItems += 1
    }

    skippedItems = Math.max(0, input.library.watchedEpisodes.length + input.library.shows.length + input.library.watchedMovies.length + input.library.movieList.length - importedItems)

    await this.db.prepare(`
      UPDATE import_jobs
      SET status = ?, imported_items = ?, failed_items = ?, completed_at = ?
      WHERE id = ? AND user_id = ?
    `).bind('completed', importedItems, 0, now, input.jobId, input.userId).run()

    const job = await this.getImportJob(input.jobId, input.userId)
    return {
      job,
      importedItems,
      skippedItems,
      failedItems: 0
    }
  }

  private async countLibrary(userId: string, status: LibraryStatus): Promise<number> {
    const row = await this.db.prepare(`
      SELECT COUNT(*) AS count FROM user_library_items WHERE user_id = ? AND status = ?
    `).bind(userId, status).first<{ count: number }>()
    return row?.count ?? 0
  }

  private async countFavorites(userId: string): Promise<number> {
    const row = await this.db.prepare(`
      SELECT COUNT(*) AS count FROM user_library_items WHERE user_id = ? AND favorite = 1
    `).bind(userId).first<{ count: number }>()
    return row?.count ?? 0
  }

  private async getImportJob(jobId: string, userId: string): Promise<ImportJob> {
    const row = await this.db.prepare('SELECT * FROM import_jobs WHERE id = ? AND user_id = ?')
      .bind(jobId, userId)
      .first<ImportJobRow>()
    if (!row) {
      throw new Error('Import job not found.')
    }
    return mapImportJob(row)
  }
}

class MemoryTrackerRepository implements AuthRepository, TrackerRepository {
  private users = new Map<string, UserAccount>()
  private usersByEmail = new Map<string, string>()
  private magicLinks = new Map<string, { email: string, expiresAt: string, usedAt?: string }>()
  private sessions = new Map<string, { userId: string, expiresAt: string }>()
  private titles = new Map<string, CatalogTitle>()
  private episodes = new Map<string, CatalogEpisode>()
  private library = new Map<string, LibraryItem>()
  private watchEventKeys = new Set<string>()
  private lists = new Map<string, { id: string, userId: string, name: string, slug: string, kind: string }>()
  private importJobs = new Map<string, ImportJob>()

  async createMagicLink(input: CreateMagicLinkInput): Promise<void> {
    this.magicLinks.set(input.tokenHash, { email: input.email, expiresAt: input.expiresAt })
  }

  async consumeMagicLink(tokenHash: string, now: string): Promise<{ email: string } | undefined> {
    const link = this.magicLinks.get(tokenHash)
    if (!link || link.usedAt || link.expiresAt <= now) {
      return undefined
    }
    link.usedAt = now
    return { email: link.email }
  }

  async upsertUserByEmail(input: { id: string, email: string, displayName?: string, now: string }): Promise<UserAccount> {
    const existingId = this.usersByEmail.get(input.email)
    if (existingId) {
      const existing = this.users.get(existingId)!
      const updated = { ...existing, updatedAt: input.now, lastLoginAt: input.now }
      this.users.set(existingId, updated)
      return updated
    }

    const user: UserAccount = {
      id: input.id,
      email: input.email,
      displayName: input.displayName,
      createdAt: input.now,
      updatedAt: input.now,
      lastLoginAt: input.now
    }
    this.users.set(user.id, user)
    this.usersByEmail.set(user.email, user.id)
    return user
  }

  async createSession(input: { id: string, userId: string, tokenHash: string, expiresAt: string }): Promise<void> {
    this.sessions.set(input.tokenHash, { userId: input.userId, expiresAt: input.expiresAt })
  }

  async findUserBySessionHash(tokenHash: string, now: string): Promise<UserAccount | undefined> {
    const session = this.sessions.get(tokenHash)
    if (!session || session.expiresAt <= now) {
      return undefined
    }
    return this.users.get(session.userId)
  }

  async deleteSession(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash)
  }

  async searchCachedTitles(input: { query: string, type?: 'movie' | 'series' | 'all', limit: number }): Promise<CatalogTitle[]> {
    const query = input.query.toLowerCase()
    return [...this.titles.values()]
      .filter((title) => (!input.type || input.type === 'all' || title.type === input.type) && title.primaryTitle.toLowerCase().includes(query))
      .slice(0, input.limit)
  }

  async upsertCatalogTitles(titles: CatalogTitle[]): Promise<void> {
    for (const title of titles) {
      this.titles.set(title.id, { ...title, updatedAt: nowIso() })
    }
  }

  async getCatalogTitle(id: string): Promise<CatalogTitle | undefined> {
    return this.titles.get(id) ?? [...this.titles.values()].find((title) => title.imdbId === id)
  }

  async upsertCatalogEpisode(episode: CatalogEpisode): Promise<void> {
    this.episodes.set(episode.id, episode)
  }

  async getDashboard(userId: string): Promise<TrackerDashboard> {
    const items = await this.getLibraryItems({ userId })
    return {
      summary: {
        watching: items.filter((item) => item.status === 'watching').length,
        watchlist: items.filter((item) => item.status === 'watchlist').length,
        completed: items.filter((item) => item.status === 'completed').length,
        paused: items.filter((item) => item.status === 'paused').length,
        dropped: items.filter((item) => item.status === 'dropped').length,
        favorites: items.filter((item) => item.favorite).length
      },
      continueWatching: items.filter((item) => item.status === 'watching').slice(0, 12),
      watchlist: items.filter((item) => item.status === 'watchlist').slice(0, 12),
      recentlyWatched: []
    }
  }

  async getLibraryItems(input: { userId: string, status?: LibraryStatus }): Promise<LibraryItem[]> {
    return [...this.library.values()]
      .filter((item) => item.userId === input.userId && (!input.status || item.status === input.status))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async upsertLibraryItem(input: { userId: string, title: CatalogTitle, status: LibraryStatus, favorite?: boolean }): Promise<LibraryItem> {
    await this.upsertCatalogTitles([input.title])
    const key = `${input.userId}:${input.title.id}`
    const existing = this.library.get(key)
    const now = nowIso()
    const item: LibraryItem = {
      userId: input.userId,
      title: input.title,
      status: input.status,
      favorite: Boolean(input.favorite ?? existing?.favorite),
      addedAt: existing?.addedAt ?? now,
      updatedAt: now
    }
    this.library.set(key, item)
    return item
  }

  async addWatchEvent(input: { sourceEventKey?: string }): Promise<void> {
    if (input.sourceEventKey) {
      this.watchEventKeys.add(input.sourceEventKey)
    }
  }

  async setEpisodeProgress(input: { episode: CatalogEpisode }): Promise<void> {
    await this.upsertCatalogEpisode(input.episode)
  }

  async setRating(): Promise<void> {}

  async createList(input: { userId: string, name: string, kind: 'custom' | 'watchlist' | 'favorites' }) {
    const list = { id: randomId('list'), userId: input.userId, name: input.name, slug: slugifyTitle(input.name), kind: input.kind }
    this.lists.set(list.id, list)
    return { id: list.id, name: list.name, slug: list.slug, kind: list.kind }
  }

  async listLists(userId: string) {
    return [...this.lists.values()]
      .filter((list) => list.userId === userId)
      .map(({ id, name, slug, kind }) => ({ id, name, slug, kind }))
  }

  async updateList(input: { userId: string, listId: string, name: string }): Promise<void> {
    const list = this.lists.get(input.listId)
    if (list?.userId === input.userId) {
      list.name = input.name
      list.slug = slugifyTitle(input.name)
    }
  }

  async addTitleToList(input: { title: CatalogTitle }): Promise<void> {
    await this.upsertCatalogTitles([input.title])
  }

  async removeTitleFromList(): Promise<void> {}

  async createImportJob(input: { userId: string, source: NormalizedLibrary['source'], totalItems: number }): Promise<ImportJob> {
    const job: ImportJob = {
      id: randomId('import'),
      userId: input.userId,
      source: input.source,
      status: 'preview',
      totalItems: input.totalItems,
      importedItems: 0,
      failedItems: 0,
      createdAt: nowIso()
    }
    this.importJobs.set(job.id, job)
    return job
  }

  async commitTvTimeImport(input: { userId: string, jobId: string, library: NormalizedLibrary }): Promise<ImportCommitResult> {
    const job = this.importJobs.get(input.jobId)
    if (!job || job.userId !== input.userId) {
      throw new Error('Import job not found.')
    }

    let importedItems = 0
    for (const title of buildImportedTitles(input.library)) {
      await this.upsertCatalogTitles([title])
    }

    for (const show of input.library.shows) {
      await this.upsertLibraryItem({
        userId: input.userId,
        title: titleFromShow(show.title, show.source.showId ?? show.id),
        status: show.archived ? 'dropped' : show.episodeCountSeen ? 'watching' : 'watchlist',
        favorite: show.favorited
      })
      importedItems += 1
    }

    for (const episode of input.library.watchedEpisodes) {
      const showTitle = titleFromEpisode(episode)
      await this.upsertLibraryItem({ userId: input.userId, title: showTitle, status: 'watching' })
      await this.setEpisodeProgress({ episode: episodeFromTvTime(episode, showTitle.id) })
      importedItems += 1
    }

    for (const movie of input.library.watchedMovies) {
      await this.upsertLibraryItem({
        userId: input.userId,
        title: titleFromMovie(movie.title, movie.source.movieId ?? movie.id, movie.releaseDate),
        status: 'completed'
      })
      importedItems += 1
    }

    for (const movie of input.library.movieList) {
      await this.upsertLibraryItem({
        userId: input.userId,
        title: titleFromMovie(movie.title, movie.source.movieId ?? movie.id, movie.releaseDate),
        status: 'watchlist'
      })
      importedItems += 1
    }

    const completed = {
      ...job,
      status: 'completed' as const,
      importedItems,
      completedAt: nowIso()
    }
    this.importJobs.set(job.id, completed)
    return { job: completed, importedItems, skippedItems: 0, failedItems: 0 }
  }
}

const memoryRepository = new MemoryTrackerRepository()

function mapUser(row: UserRow): UserAccount {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at ?? undefined
  }
}

function mapTitle(row: TitleRow): CatalogTitle {
  return {
    id: row.id,
    imdbId: row.imdb_id ?? undefined,
    type: row.type,
    primaryTitle: row.primary_title,
    originalTitle: row.original_title ?? undefined,
    primaryImageUrl: row.primary_image_url ?? undefined,
    startYear: row.start_year ?? undefined,
    endYear: row.end_year ?? undefined,
    runtimeSeconds: row.runtime_seconds ?? undefined,
    plot: row.plot ?? undefined,
    ratingAverage: row.rating_average ?? undefined,
    ratingCount: row.rating_count ?? undefined,
    genres: parseJsonArray(row.genres_json),
    nextRelease: row.next_release_type
      ? {
          kind: row.next_release_type,
          title: row.next_release_title ?? undefined,
          date: row.next_release_date ?? undefined,
          seasonNumber: row.next_release_season_number ?? undefined,
          episodeNumber: row.next_release_episode_number ?? undefined,
          source: row.next_release_source ?? 'catalog'
        }
      : undefined,
    sourcePayload: row.source_payload_json ? JSON.parse(row.source_payload_json) : undefined,
    fetchedAt: row.fetched_at ?? undefined,
    updatedAt: row.updated_at ?? undefined
  }
}

function mapLibraryItem(row: LibraryRow): LibraryItem {
  return {
    userId: row.user_id,
    title: mapTitle(row),
    status: row.status,
    favorite: Boolean(row.favorite),
    addedAt: row.added_at,
    updatedAt: row.library_updated_at
  }
}

function mapImportJob(row: ImportJobRow): ImportJob {
  return {
    id: row.id,
    userId: row.user_id,
    source: row.source,
    status: row.status,
    totalItems: row.total_items,
    importedItems: row.imported_items,
    failedItems: row.failed_items,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? undefined
  }
}

function titleBindings(title: CatalogTitle): unknown[] {
  const now = nowIso()
  return [
    title.id,
    title.imdbId ?? null,
    title.type,
    title.primaryTitle,
    title.originalTitle ?? null,
    title.primaryImageUrl ?? null,
    title.startYear ?? null,
    title.endYear ?? null,
    title.runtimeSeconds ?? null,
    title.plot ?? null,
    title.ratingAverage ?? null,
    title.ratingCount ?? null,
    encodeJson(title.genres),
    title.nextRelease?.kind ?? null,
    title.nextRelease?.title ?? null,
    title.nextRelease?.date ?? null,
    title.nextRelease?.seasonNumber ?? null,
    title.nextRelease?.episodeNumber ?? null,
    title.nextRelease?.source ?? null,
    title.sourcePayload ? encodeJson(title.sourcePayload) : null,
    title.fetchedAt ?? null,
    title.updatedAt ?? now
  ]
}

function buildImportedTitles(library: NormalizedLibrary): CatalogTitle[] {
  const titles = new Map<string, CatalogTitle>()
  for (const show of library.shows) {
    const title = titleFromShow(show.title, show.source.showId ?? show.id)
    titles.set(title.id, title)
  }
  for (const episode of library.watchedEpisodes) {
    const title = titleFromEpisode(episode)
    titles.set(title.id, title)
  }
  for (const movie of library.watchedMovies) {
    const title = titleFromMovie(movie.title, movie.source.movieId ?? movie.id, movie.releaseDate)
    titles.set(title.id, title)
  }
  for (const movie of library.movieList) {
    const title = titleFromMovie(movie.title, movie.source.movieId ?? movie.id, movie.releaseDate)
    titles.set(title.id, title)
  }
  return [...titles.values()]
}

function titleFromEpisode(episode: WatchedEpisode): CatalogTitle {
  return titleFromShow(episode.showTitle, episode.source.showId ?? stableMediaId(['tvtime', 'show', episode.showTitle]))
}

function titleFromShow(title: string, sourceKey: string): CatalogTitle {
  return {
    id: catalogTitleId({ sourceKey: `tvtime-show-${sourceKey}`, title }),
    type: 'series',
    primaryTitle: title,
    genres: [],
    sourcePayload: { source: 'tvtime-gdpr', sourceKey }
  }
}

function titleFromMovie(title: string, sourceKey: string, releaseDate?: string): CatalogTitle {
  return {
    id: catalogTitleId({ sourceKey: `tvtime-movie-${sourceKey}`, title }),
    type: 'movie',
    primaryTitle: title,
    startYear: releaseDate ? Number.parseInt(releaseDate.slice(0, 4), 10) || undefined : undefined,
    genres: [],
    sourcePayload: { source: 'tvtime-gdpr', sourceKey }
  }
}

function episodeFromTvTime(episode: WatchedEpisode, seriesTitleId: string): CatalogEpisode {
  return {
    id: catalogTitleId({ sourceKey: `tvtime-episode-${episode.id}`, title: `${episode.showTitle} S${episode.seasonNumber}E${episode.episodeNumber}` }),
    seriesTitleId,
    seasonNumber: episode.seasonNumber,
    episodeNumber: episode.episodeNumber,
    primaryTitle: `${episode.showTitle} S${episode.seasonNumber}E${episode.episodeNumber}`,
    runtimeSeconds: episode.runtimeMinutes ? episode.runtimeMinutes * 60 : undefined,
    fetchedAt: nowIso()
  }
}
