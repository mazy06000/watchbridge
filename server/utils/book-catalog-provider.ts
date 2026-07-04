import type { BookWork } from '~~/core/domain/books'
import { bookWorkIdFromGoogleVolumeId, bookWorkIdFromOpenLibraryKey } from '~~/core/domain/books'
import type { BookCatalogProvider, BookSearchInput } from '~~/core/ports/book-catalog-provider'

const OPEN_LIBRARY_BASE_URL = 'https://openlibrary.org'
const GOOGLE_BOOKS_BASE_URL = 'https://www.googleapis.com/books/v1'

interface BookCatalogConfig {
  googleBooksApiKey?: string
  language?: string
}

interface CatalogLanguage {
  primary: string
  google: string
  openLibrary?: string
}

interface OpenLibrarySearchResponse {
  docs?: OpenLibrarySearchDoc[]
}

interface OpenLibrarySearchDoc {
  key?: string
  title?: string
  subtitle?: string
  author_key?: string[]
  author_name?: string[]
  first_publish_year?: number
  cover_i?: number
  subject?: string[]
  isbn?: string[]
  edition_count?: number
  language?: string[]
}

interface OpenLibraryWorkResponse {
  key?: string
  title?: string
  subtitle?: string
  description?: string | { value?: string }
  covers?: number[]
  subjects?: string[]
  first_publish_date?: string
  authors?: Array<{
    author?: {
      key?: string
    }
  }>
}

interface OpenLibraryAuthorResponse {
  key?: string
  name?: string
  personal_name?: string
}

interface GoogleBooksSearchResponse {
  items?: GoogleVolume[]
}

interface GoogleVolume {
  id?: string
  volumeInfo?: {
    title?: string
    subtitle?: string
    authors?: string[]
    description?: string
    publishedDate?: string
    pageCount?: number
    categories?: string[]
    industryIdentifiers?: Array<{
      type?: string
      identifier?: string
    }>
    imageLinks?: {
      thumbnail?: string
      smallThumbnail?: string
    }
  }
}

export function createBookCatalogProvider(config: BookCatalogConfig = {}): BookCatalogProvider {
  const language = normalizeCatalogLanguage(config.language)
  return {
    async search(input: BookSearchInput) {
      const openLibraryResults = await searchOpenLibrary(input, language)
      if (openLibraryResults.length > 0) {
        return openLibraryResults
      }

      return searchGoogleBooks(input, config, language)
    },
    async getBook(id: string) {
      if (id.startsWith('ol-work-')) {
        return getOpenLibraryWork(id, language)
      }
      if (id.startsWith('google-volume-')) {
        return getGoogleVolume(id, config, language)
      }
      return undefined
    },
    async getRelatedBooks(input: { book: BookWork, limit?: number }) {
      return getRelatedBooks(input.book, input.limit ?? 12, config, language)
    }
  }
}

export function bookCatalogLanguageFromAcceptLanguage(value: string | null | undefined): string {
  return value?.split(',')[0]?.trim() || 'en-US'
}

async function searchOpenLibrary(input: BookSearchInput, language: CatalogLanguage): Promise<BookWork[]> {
  const query = input.query.trim()
  const limit = Math.min(Math.max(input.limit ?? 12, 1), 30)
  const target = new URL(`${OPEN_LIBRARY_BASE_URL}/search.json`)
  target.searchParams.set('q', query)
  target.searchParams.set('limit', String(limit))
  if (language.openLibrary) {
    target.searchParams.set('language', language.openLibrary)
  }
  target.searchParams.set('fields', [
    'key',
    'title',
    'subtitle',
    'author_key',
    'author_name',
    'first_publish_year',
    'cover_i',
    'subject',
    'isbn',
    'edition_count',
    'language'
  ].join(','))

  const response = await fetchJson<OpenLibrarySearchResponse>(target.toString())
  return (response?.docs ?? [])
    .map(normalizeOpenLibrarySearchDoc)
    .filter((work): work is BookWork => Boolean(work))
    .slice(0, limit)
}

async function getOpenLibraryWork(id: string, language: CatalogLanguage): Promise<BookWork | undefined> {
  const workKey = `/works/${id.replace(/^ol-work-/, '')}`
  const response = await fetchJson<OpenLibraryWorkResponse>(`${OPEN_LIBRARY_BASE_URL}${workKey}.json`)
  const work = normalizeOpenLibraryWork(response, await resolveOpenLibraryAuthors(response), language)
  if (!work || work.coverUrl) {
    return work
  }

  const searchMatch = (await searchOpenLibrary({ query: work.title, limit: 10 }, language))
    .find((candidate) => candidate.id === work.id)
  return mergeBookWork(work, searchMatch)
}

async function searchGoogleBooks(input: BookSearchInput, config: BookCatalogConfig, language: CatalogLanguage): Promise<BookWork[]> {
  const query = input.query.trim()
  const limit = Math.min(Math.max(input.limit ?? 12, 1), 30)
  const target = new URL(`${GOOGLE_BOOKS_BASE_URL}/volumes`)
  target.searchParams.set('q', query)
  target.searchParams.set('maxResults', String(Math.min(limit, 40)))
  target.searchParams.set('printType', 'books')
  target.searchParams.set('langRestrict', language.google)
  target.searchParams.set('hl', language.google)
  if (config.googleBooksApiKey) {
    target.searchParams.set('key', config.googleBooksApiKey)
  }

  const response = await fetchJson<GoogleBooksSearchResponse>(target.toString())
  return (response?.items ?? [])
    .map((volume) => normalizeGoogleVolume(volume, language))
    .filter((work): work is BookWork => Boolean(work))
    .slice(0, limit)
}

async function getGoogleVolume(id: string, config: BookCatalogConfig, language: CatalogLanguage): Promise<BookWork | undefined> {
  const volumeId = id.replace(/^google-volume-/, '')
  const target = new URL(`${GOOGLE_BOOKS_BASE_URL}/volumes/${encodeURIComponent(volumeId)}`)
  target.searchParams.set('hl', language.google)
  if (config.googleBooksApiKey) {
    target.searchParams.set('key', config.googleBooksApiKey)
  }

  const response = await fetchJson<GoogleVolume>(target.toString())
  return normalizeGoogleVolume(response, language)
}

async function getRelatedBooks(book: BookWork, limit: number, config: BookCatalogConfig, language: CatalogLanguage): Promise<BookWork[]> {
  const primaryAuthor = book.authors[0]?.name
  if (!primaryAuthor) {
    return []
  }

  const searchLimit = Math.min(Math.max(limit * 2, 8), 30)
  const seriesQuery = seriesSearchQuery(book.title, primaryAuthor)
  const openLibraryResults = await searchOpenLibrary({
    query: seriesQuery,
    limit: searchLimit
  }, language)
  const ranked = rankRelatedBooks(book, openLibraryResults, primaryAuthor).slice(0, limit)
  if (ranked.length > 1) {
    return ranked
  }

  const googleResults = await searchGoogleBooks({
    query: seriesQuery,
    limit: searchLimit
  }, config, language)
  return rankRelatedBooks(book, [...ranked, ...googleResults], primaryAuthor).slice(0, limit)
}

function seriesSearchQuery(title: string, author: string): string {
  const baseTitle = title
    .replace(/\([^)]*\)/g, '')
    .replace(/[:#]\s*\d+.*/g, '')
    .replace(/\b(book|volume|vol)\s+\d+\b/gi, '')
    .trim()
  return `${baseTitle} ${author}`.trim()
}

function rankRelatedBooks(book: BookWork, candidates: BookWork[], author: string): BookWork[] {
  const authorNeedle = author.toLowerCase()
  const seen = new Set<string>()
  return candidates
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => candidate.authors.some((candidateAuthor) => candidateAuthor.name.toLowerCase() === authorNeedle))
    .filter(({ candidate }) => !isNoisyRelatedCandidate(book, candidate))
    .filter(({ candidate }) => {
      const key = normalizedRelatedTitle(candidate.title)
      if (seen.has(candidate.id) || seen.has(key)) {
        return false
      }
      seen.add(candidate.id)
      seen.add(key)
      return true
    })
    .sort((a, b) => relatedRank(book, a.candidate, a.index) - relatedRank(book, b.candidate, b.index))
    .map(({ candidate }) => candidate)
}

function isNoisyRelatedCandidate(source: BookWork, candidate: BookWork): boolean {
  if (source.id === candidate.id) {
    return false
  }

  const title = candidate.title.toLowerCase()
  return [
    /\b(summary|summaries|study guide|companion|cocktail|making of|guide)\b/,
    /\b(boxed set|box set|complete set|collection set|books collection)\b/,
    /\bseries\b.*\b(collection|set|books?)\b/
  ].some((pattern) => pattern.test(title))
}

function relatedRank(source: BookWork, candidate: BookWork, index: number): number {
  let score = index * 10
  if (source.id === candidate.id) {
    score -= 1000
  }
  if (normalizedRelatedTitle(source.title) === normalizedRelatedTitle(candidate.title)) {
    score -= 100
  }
  if (/\b(graphic novel|novella)\b/i.test(candidate.title)) {
    score += 75
  }
  return score
}

function normalizedRelatedTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/\ban?\s+[^:()]*graphic novel\b/g, '')
    .replace(/\bgraphic novel\b/g, '')
    .replace(/\ba novel\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function mergeBookWork(primary: BookWork, fallback: BookWork | undefined): BookWork {
  if (!fallback) {
    return primary
  }

  return {
    ...primary,
    subtitle: primary.subtitle ?? fallback.subtitle,
    coverUrl: primary.coverUrl ?? fallback.coverUrl,
    firstPublishYear: primary.firstPublishYear ?? fallback.firstPublishYear,
    subjects: primary.subjects.length > 0 ? primary.subjects : fallback.subjects,
    sourcePayload: mergeSourcePayload(fallback.sourcePayload, primary.sourcePayload)
  }
}

function mergeSourcePayload(fallback: unknown, primary: unknown): unknown {
  if (isPlainRecord(fallback) && isPlainRecord(primary)) {
    return { ...fallback, ...primary }
  }
  return primary ?? fallback
}

function normalizeOpenLibrarySearchDoc(doc: OpenLibrarySearchDoc): BookWork | undefined {
  if (!doc.key || !doc.title) {
    return undefined
  }

  return {
    id: bookWorkIdFromOpenLibraryKey(doc.key),
    title: doc.title,
    subtitle: doc.subtitle,
    authors: normalizeOpenLibraryAuthors(doc.author_key, doc.author_name),
    coverUrl: doc.cover_i ? openLibraryCoverUrl(doc.cover_i) : undefined,
    firstPublishYear: doc.first_publish_year,
    subjects: (doc.subject ?? []).slice(0, 8),
    sourcePayload: {
      provider: 'openlibrary',
      workKey: doc.key,
      isbn: doc.isbn?.slice(0, 8),
      editionCount: doc.edition_count,
      language: doc.language?.slice(0, 8)
    },
    fetchedAt: new Date().toISOString()
  }
}

function normalizeOpenLibraryWork(work: OpenLibraryWorkResponse | undefined, authors: Array<{ id: string, name: string }>, language: CatalogLanguage): BookWork | undefined {
  if (!work?.key || !work.title) {
    return undefined
  }

  return {
    id: bookWorkIdFromOpenLibraryKey(work.key),
    title: work.title,
    subtitle: work.subtitle,
    authors,
    description: normalizeDescription(work.description, language),
    coverUrl: work.covers?.[0] ? openLibraryCoverUrl(work.covers[0]) : undefined,
    firstPublishYear: yearFromDate(work.first_publish_date),
    subjects: (work.subjects ?? []).slice(0, 12),
    sourcePayload: {
      provider: 'openlibrary',
      workKey: work.key
    },
    fetchedAt: new Date().toISOString()
  }
}

async function resolveOpenLibraryAuthors(work: OpenLibraryWorkResponse | undefined): Promise<Array<{ id: string, name: string }>> {
  const authorKeys = (work?.authors ?? [])
    .map((author) => author.author?.key)
    .filter((key): key is string => Boolean(key))
    .slice(0, 8)

  const authors = await Promise.all(authorKeys.map(async (key) => {
    const author = await fetchJson<OpenLibraryAuthorResponse>(`${OPEN_LIBRARY_BASE_URL}${key}.json`)
    return {
      id: `ol-author-${key.replace('/authors/', '')}`,
      name: author?.name ?? author?.personal_name ?? key.replace('/authors/', '')
    }
  }))

  return authors.filter((author) => author.name)
}

function normalizeGoogleVolume(volume: GoogleVolume | undefined, language: CatalogLanguage): BookWork | undefined {
  if (!volume?.id || !volume.volumeInfo?.title) {
    return undefined
  }

  const info = volume.volumeInfo
  const title = info.title
  if (!title) {
    return undefined
  }
  return {
    id: bookWorkIdFromGoogleVolumeId(volume.id),
    title,
    subtitle: info.subtitle,
    authors: (info.authors ?? []).map((name) => ({
      id: `google-author-${slugPart(name)}`,
      name
    })),
    description: normalizeDescription(info.description, language),
    coverUrl: normalizeGoogleImage(info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail),
    firstPublishYear: yearFromDate(info.publishedDate),
    subjects: (info.categories ?? []).slice(0, 8),
    sourcePayload: {
      provider: 'google-books',
      volumeId: volume.id,
      isbn: info.industryIdentifiers,
      pageCount: info.pageCount,
      publishedDate: info.publishedDate,
      language: language.primary
    },
    fetchedAt: new Date().toISOString()
  }
}

function normalizeOpenLibraryAuthors(authorKeys: string[] | undefined, authorNames: string[] | undefined) {
  const names = authorNames ?? []
  return names.slice(0, 8).map((name, index) => ({
    id: authorKeys?.[index] ? `ol-author-${authorKeys[index]}` : `author-${slugPart(name)}`,
    name
  }))
}

function normalizeDescription(value: OpenLibraryWorkResponse['description'] | string | undefined, language: CatalogLanguage): string | undefined {
  const raw = typeof value === 'string' ? value : value?.value
  if (!raw) {
    return undefined
  }

  return pickLocalizedDescription(cleanDescription(raw), language.primary)
}

function openLibraryCoverUrl(coverId: number): string {
  return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
}

function normalizeGoogleImage(value: string | undefined): string | undefined {
  return value?.replace(/^http:\/\//, 'https://')
}

function yearFromDate(value: string | undefined): number | undefined {
  const year = value?.slice(0, 4)
  return year ? Number.parseInt(year, 10) || undefined : undefined
}

function slugPart(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function normalizeCatalogLanguage(value: string | undefined): CatalogLanguage {
  const primary = value?.split(',')[0]?.trim().toLowerCase().split('-')[0] || 'en'
  return {
    primary,
    google: primary,
    openLibrary: openLibraryLanguageCode(primary)
  }
}

function openLibraryLanguageCode(primary: string): string | undefined {
  const map: Record<string, string> = {
    en: 'eng',
    fr: 'fre',
    es: 'spa',
    de: 'ger',
    it: 'ita',
    pt: 'por',
    nl: 'dut',
    ar: 'ara'
  }
  return map[primary]
}

function cleanDescription(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .replace(/^[«"\s]+|[»"\s]+$/g, '')
    .trim()
}

function pickLocalizedDescription(value: string, primaryLanguage: string): string | undefined {
  const segments = languageSegments(value)
  const wanted = segments.find((segment) => segment.language === primaryLanguage)
  if (wanted) {
    return stripLanguageMarker(wanted.text)
  }

  if (segments.length > 0) {
    const unmarked = segments.find((segment) => segment.language === 'unknown')
    return stripLanguageMarker(unmarked?.text ?? segments[0]?.text)
  }

  return stripLanguageMarker(value)
}

function languageSegments(value: string): Array<{ language: string, text: string }> {
  const markers = [
    { language: 'en', pattern: /\b(?:in\s+english|english|en)\s*:/i },
    { language: 'fr', pattern: /\b(?:en\s+fran[cç]ais|in\s+french|french|fr)\s*:/i },
    { language: 'es', pattern: /\b(?:en\s+espa[ñn]ol|in\s+spanish|spanish|es)\s*:/i },
    { language: 'de', pattern: /\b(?:auf\s+deutsch|in\s+german|german|de)\s*:/i }
  ]
  const matches = markers
    .flatMap(({ language, pattern }) => [...value.matchAll(new RegExp(pattern, 'gi'))].map((match) => ({
      language,
      index: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length
    })))
    .sort((a, b) => a.index - b.index)

  if (matches.length === 0) {
    return []
  }

  const firstMatch = matches[0]
  if (!firstMatch) {
    return []
  }

  const leading = value.slice(0, firstMatch.index).trim()
  const segments: Array<{ language: string, text: string }> = leading
    ? [{ language: 'unknown', text: leading }]
    : []

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]
    if (!match) {
      continue
    }
    const next = matches[index + 1]
    const text = value.slice(match.end, next?.index ?? value.length).trim()
    if (text) {
      segments.push({ language: match.language, text })
    }
  }

  return segments
}

function stripLanguageMarker(value: string | undefined): string | undefined {
  const stripped = value
    ?.replace(/^[«"\s]+|[»"\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return stripped || undefined
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

async function fetchJson<T>(url: string): Promise<T | undefined> {
  try {
    const response = await fetch(url, {
      headers: {
        accept: 'application/json'
      }
    })

    if (!response.ok) {
      return undefined
    }

    return await response.json() as T
  } catch {
    return undefined
  }
}
