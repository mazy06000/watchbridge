import type { NormalizedLibrary } from '../domain/media'
import type {
  CatalogEpisode,
  CatalogTitle,
  ImportCommitResult,
  ImportJob,
  LibraryItem,
  LibraryStatus,
  TrackerDashboard,
  UserAccount
} from '../domain/tracker'

export interface CreateMagicLinkInput {
  id: string
  email: string
  tokenHash: string
  expiresAt: string
}

export interface AuthRepository {
  createMagicLink(input: CreateMagicLinkInput): Promise<void>
  consumeMagicLink(tokenHash: string, now: string): Promise<{ email: string } | undefined>
  upsertUserByEmail(input: { id: string, email: string, displayName?: string, now: string }): Promise<UserAccount>
  createSession(input: { id: string, userId: string, tokenHash: string, expiresAt: string, now: string }): Promise<void>
  findUserBySessionHash(tokenHash: string, now: string): Promise<UserAccount | undefined>
  deleteSession(tokenHash: string): Promise<void>
}

export interface TrackerRepository {
  searchCachedTitles(input: { query: string, type?: 'movie' | 'series' | 'all', limit: number }): Promise<CatalogTitle[]>
  upsertCatalogTitles(titles: CatalogTitle[]): Promise<void>
  getCatalogTitle(id: string): Promise<CatalogTitle | undefined>
  upsertCatalogEpisode(episode: CatalogEpisode): Promise<void>
  getDashboard(userId: string): Promise<TrackerDashboard>
  getLibraryItems(input: { userId: string, status?: LibraryStatus }): Promise<LibraryItem[]>
  upsertLibraryItem(input: { userId: string, title: CatalogTitle, status: LibraryStatus, favorite?: boolean }): Promise<LibraryItem>
  addWatchEvent(input: { userId: string, titleId?: string, episodeId?: string, watchedAt: string, source: 'manual' | 'import' | 'provider', sourceEventKey?: string }): Promise<void>
  setEpisodeProgress(input: { userId: string, episode: CatalogEpisode, watched: boolean, watchedAt?: string }): Promise<void>
  setRating(input: { userId: string, titleId?: string, episodeId?: string, rating10: number, reviewText?: string }): Promise<void>
  createList(input: { userId: string, name: string, kind: 'custom' | 'watchlist' | 'favorites' }): Promise<{ id: string, name: string, slug: string, kind: string }>
  listLists(userId: string): Promise<Array<{ id: string, name: string, slug: string, kind: string }>>
  updateList(input: { userId: string, listId: string, name: string }): Promise<void>
  addTitleToList(input: { userId: string, listId: string, title: CatalogTitle }): Promise<void>
  removeTitleFromList(input: { userId: string, listId: string, titleId: string }): Promise<void>
  createImportJob(input: { userId: string, source: NormalizedLibrary['source'], totalItems: number }): Promise<ImportJob>
  commitTvTimeImport(input: { userId: string, jobId: string, library: NormalizedLibrary }): Promise<ImportCommitResult>
}
