import type { CatalogProvider, CatalogSearchInput } from '~~/core/ports/catalog-provider'
import type { CatalogNextRelease, CatalogTitle, CatalogTitleType } from '~~/core/domain/tracker'

const TMDB_API_BASE_URL = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500'
const TVMAZE_API_BASE_URL = 'https://api.tvmaze.com'

interface TmdbCatalogProviderConfig {
  accessToken?: string
  apiKey?: string
  language?: string
}

interface TmdbAuthConfig {
  accessToken?: string
  apiKey?: string
  language: string
}

interface TmdbSearchResponse {
  results?: TmdbSearchResult[]
}

interface TmdbSearchResult {
  id?: number
  media_type?: 'movie' | 'tv' | 'person'
  title?: string
  name?: string
  original_title?: string
  original_name?: string
  overview?: string
  poster_path?: string | null
  release_date?: string
  first_air_date?: string
  vote_average?: number
  vote_count?: number
}

interface TmdbGenre {
  id?: number
  name?: string
}

interface TmdbExternalIds {
  imdb_id?: string | null
  tvdb_id?: number | null
}

interface TmdbEpisode {
  id?: number
  name?: string
  overview?: string
  air_date?: string
  season_number?: number
  episode_number?: number
  runtime?: number | null
}

interface TmdbMovieDetails extends TmdbSearchResult {
  imdb_id?: string | null
  runtime?: number | null
  genres?: TmdbGenre[]
  status?: string
}

interface TmdbTvDetails extends TmdbSearchResult {
  external_ids?: TmdbExternalIds
  episode_run_time?: number[]
  genres?: TmdbGenre[]
  last_air_date?: string
  next_episode_to_air?: TmdbEpisode | null
  status?: string
}

interface TvMazeShow {
  id?: number
  _embedded?: {
    nextepisode?: TvMazeEpisode
  }
}

interface TvMazeEpisode {
  name?: string
  season?: number
  number?: number
  airdate?: string
  airstamp?: string
  runtime?: number
}

export function createTmdbCatalogProvider(config: TmdbCatalogProviderConfig = {}): CatalogProvider {
  const auth = {
    accessToken: config.accessToken?.trim(),
    apiKey: config.apiKey?.trim(),
    language: config.language || 'en-US'
  }

  return {
    async search(input: CatalogSearchInput) {
      return searchTmdb(input, auth)
    },
    async getTitle(id: string) {
      return getTmdbTitle(id, auth)
    }
  }
}

async function searchTmdb(input: CatalogSearchInput, auth: TmdbAuthConfig): Promise<CatalogTitle[]> {
  const query = input.query.trim()
  const limit = Math.min(Math.max(input.limit ?? 12, 1), 30)
  const endpoint = searchEndpoint(input.type)
  const response = await fetchTmdbJson<TmdbSearchResponse>(endpoint, {
    query,
    include_adult: 'false',
    language: auth.language,
    page: '1'
  }, auth)

  return (response?.results ?? [])
    .map((result) => normalizeTmdbSearchResult(result, input.type))
    .filter((title): title is CatalogTitle => Boolean(title))
    .slice(0, limit)
}

async function getTmdbTitle(id: string, auth: TmdbAuthConfig): Promise<CatalogTitle | undefined> {
  const parsed = parseTmdbTitleId(id)
  if (parsed) {
    return parsed.kind === 'movie'
      ? getTmdbMovie(parsed.tmdbId, auth)
      : getTmdbSeries(parsed.tmdbId, auth)
  }

  if (/^tt\d+$/i.test(id)) {
    const found = await fetchTmdbJson<{ movie_results?: TmdbSearchResult[], tv_results?: TmdbSearchResult[] }>(
      `/find/${encodeURIComponent(id)}`,
      { external_source: 'imdb_id', language: auth.language },
      auth
    )
    const movie = found?.movie_results?.[0]
    if (movie?.id) {
      return getTmdbMovie(movie.id, auth)
    }
    const series = found?.tv_results?.[0]
    if (series?.id) {
      return getTmdbSeries(series.id, auth)
    }
  }

  return undefined
}

async function getTmdbMovie(tmdbId: number, auth: TmdbAuthConfig): Promise<CatalogTitle | undefined> {
  const movie = await fetchTmdbJson<TmdbMovieDetails>(`/movie/${tmdbId}`, {
    append_to_response: 'external_ids',
    language: auth.language
  }, auth)
  return normalizeTmdbMovie(movie)
}

async function getTmdbSeries(tmdbId: number, auth: TmdbAuthConfig): Promise<CatalogTitle | undefined> {
  const series = await fetchTmdbJson<TmdbTvDetails>(`/tv/${tmdbId}`, {
    append_to_response: 'external_ids',
    language: auth.language
  }, auth)
  if (!series) {
    return undefined
  }

  const tmdbNextRelease = normalizeTmdbNextEpisode(series.next_episode_to_air)
  const tvMazeNextRelease = tmdbNextRelease
    ? undefined
    : await fetchTvMazeNextEpisode(series.external_ids)

  return normalizeTmdbSeries(series, tmdbNextRelease ?? tvMazeNextRelease)
}

function searchEndpoint(type: CatalogSearchInput['type']): string {
  if (type === 'movie') {
    return '/search/movie'
  }
  if (type === 'series') {
    return '/search/tv'
  }
  return '/search/multi'
}

function normalizeTmdbSearchResult(input: TmdbSearchResult, requestedType?: CatalogTitleType | 'all'): CatalogTitle | undefined {
  const type = normalizeTmdbType(input.media_type, requestedType)
  if (!type || !input.id) {
    return undefined
  }

  const primaryTitle = type === 'movie' ? input.title : input.name
  if (!primaryTitle) {
    return undefined
  }

  return {
    id: tmdbTitleId(type, input.id),
    type,
    primaryTitle,
    originalTitle: type === 'movie' ? input.original_title : input.original_name,
    primaryImageUrl: posterUrl(input.poster_path),
    startYear: yearFromDate(type === 'movie' ? input.release_date : input.first_air_date),
    plot: input.overview,
    ratingAverage: input.vote_average,
    ratingCount: input.vote_count,
    genres: [],
    nextRelease: type === 'movie' ? upcomingMovieRelease(input.release_date) : undefined,
    sourcePayload: {
      provider: 'tmdb',
      tmdbId: input.id
    },
    fetchedAt: new Date().toISOString()
  }
}

function normalizeTmdbMovie(input: TmdbMovieDetails | undefined): CatalogTitle | undefined {
  if (!input?.id || !input.title) {
    return undefined
  }

  return {
    id: tmdbTitleId('movie', input.id),
    imdbId: input.imdb_id ?? undefined,
    type: 'movie',
    primaryTitle: input.title,
    originalTitle: input.original_title,
    primaryImageUrl: posterUrl(input.poster_path),
    startYear: yearFromDate(input.release_date),
    runtimeSeconds: input.runtime ? input.runtime * 60 : undefined,
    plot: input.overview,
    ratingAverage: input.vote_average,
    ratingCount: input.vote_count,
    genres: genreNames(input.genres),
    nextRelease: upcomingMovieRelease(input.release_date),
    sourcePayload: {
      provider: 'tmdb',
      tmdbId: input.id,
      status: input.status
    },
    fetchedAt: new Date().toISOString()
  }
}

function normalizeTmdbSeries(input: TmdbTvDetails, nextRelease?: CatalogNextRelease): CatalogTitle | undefined {
  if (!input.id || !input.name) {
    return undefined
  }

  const runtimeMinutes = input.episode_run_time?.find((value) => Number.isFinite(value) && value > 0)

  return {
    id: tmdbTitleId('series', input.id),
    imdbId: input.external_ids?.imdb_id ?? undefined,
    type: 'series',
    primaryTitle: input.name,
    originalTitle: input.original_name,
    primaryImageUrl: posterUrl(input.poster_path),
    startYear: yearFromDate(input.first_air_date),
    endYear: input.status === 'Ended' ? yearFromDate(input.last_air_date) : undefined,
    runtimeSeconds: runtimeMinutes ? runtimeMinutes * 60 : undefined,
    plot: input.overview,
    ratingAverage: input.vote_average,
    ratingCount: input.vote_count,
    genres: genreNames(input.genres),
    nextRelease,
    sourcePayload: {
      provider: 'tmdb',
      tmdbId: input.id,
      tvdbId: input.external_ids?.tvdb_id,
      status: input.status
    },
    fetchedAt: new Date().toISOString()
  }
}

function normalizeTmdbNextEpisode(episode: TmdbEpisode | null | undefined): CatalogNextRelease | undefined {
  if (!episode?.air_date) {
    return undefined
  }

  return {
    kind: 'episode',
    title: episode.name,
    date: episode.air_date,
    seasonNumber: episode.season_number,
    episodeNumber: episode.episode_number,
    source: 'tmdb'
  }
}

async function fetchTvMazeNextEpisode(externalIds: TmdbExternalIds | undefined): Promise<CatalogNextRelease | undefined> {
  const lookupUrls = [
    externalIds?.imdb_id ? `/lookup/shows?imdb=${encodeURIComponent(externalIds.imdb_id)}` : undefined,
    externalIds?.tvdb_id ? `/lookup/shows?thetvdb=${encodeURIComponent(String(externalIds.tvdb_id))}` : undefined
  ].filter((url): url is string => Boolean(url))

  for (const lookupUrl of lookupUrls) {
    const show = await fetchJson<TvMazeShow>(`${TVMAZE_API_BASE_URL}${lookupUrl}`)
    if (!show?.id) {
      continue
    }

    const showWithEpisode = await fetchJson<TvMazeShow>(`${TVMAZE_API_BASE_URL}/shows/${show.id}?embed=nextepisode`)
    const episode = showWithEpisode?._embedded?.nextepisode
    if (episode) {
      return {
        kind: 'episode',
        title: episode.name,
        date: episode.airdate || episode.airstamp?.slice(0, 10),
        seasonNumber: episode.season,
        episodeNumber: episode.number,
        source: 'tvmaze'
      }
    }
  }

  return undefined
}

function normalizeTmdbType(mediaType: TmdbSearchResult['media_type'], requestedType?: CatalogTitleType | 'all'): CatalogTitleType | undefined {
  if (mediaType === 'movie') {
    return 'movie'
  }
  if (mediaType === 'tv') {
    return 'series'
  }
  if (requestedType === 'movie' || requestedType === 'series') {
    return requestedType
  }
  return undefined
}

function tmdbTitleId(type: CatalogTitleType, tmdbId: number): string {
  return `tmdb-${type === 'movie' ? 'movie' : 'tv'}-${tmdbId}`
}

function parseTmdbTitleId(id: string): { kind: 'movie' | 'series', tmdbId: number } | undefined {
  const match = /^(?:local-)?tmdb-(movie|tv|series)-(\d+)$/i.exec(id.trim())
  if (!match) {
    return undefined
  }

  const [, rawKind, rawId] = match
  if (!rawKind || !rawId) {
    return undefined
  }

  return {
    kind: rawKind.toLowerCase() === 'movie' ? 'movie' : 'series',
    tmdbId: Number.parseInt(rawId, 10)
  }
}

function posterUrl(path: string | null | undefined): string | undefined {
  return path ? `${TMDB_IMAGE_BASE_URL}${path}` : undefined
}

function yearFromDate(date: string | undefined): number | undefined {
  const year = date?.slice(0, 4)
  return year ? Number.parseInt(year, 10) || undefined : undefined
}

function genreNames(genres: TmdbGenre[] | undefined): string[] {
  return (genres ?? [])
    .map((genre) => genre.name)
    .filter((name): name is string => Boolean(name))
}

function upcomingMovieRelease(releaseDate: string | undefined): CatalogNextRelease | undefined {
  if (!releaseDate || releaseDate < new Date().toISOString().slice(0, 10)) {
    return undefined
  }

  return {
    kind: 'movie',
    title: 'Theatrical release',
    date: releaseDate,
    source: 'tmdb'
  }
}

async function fetchTmdbJson<T>(
  path: string,
  params: Record<string, string | undefined>,
  auth: TmdbAuthConfig
): Promise<T | undefined> {
  if (!auth.accessToken && !auth.apiKey) {
    return undefined
  }

  const target = new URL(`${TMDB_API_BASE_URL}${path}`)
  if (auth.apiKey) {
    target.searchParams.set('api_key', auth.apiKey)
  }
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      target.searchParams.set(key, value)
    }
  }

  return fetchJson<T>(target.toString(), auth.accessToken
    ? { authorization: `Bearer ${auth.accessToken}` }
    : undefined)
}

async function fetchJson<T>(url: string, headers?: HeadersInit): Promise<T | undefined> {
  try {
    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
        ...headers
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
