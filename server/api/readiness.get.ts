import { betaseriesCapabilities } from '~~/server/utils/betaseries-provider'
import { getD1Database } from '~~/server/utils/d1'

export default defineEventHandler((event) => {
  setNoStoreHeaders(event)

  const config = useRuntimeConfig(event)
  const betaSeriesMissing = missingConfigKeys({
    NUXT_BETASERIES_API_KEY: config.betaseriesApiKey,
    NUXT_BETASERIES_CLIENT_SECRET: config.betaseriesClientSecret,
    NUXT_OAUTH_STATE_SECRET: config.oauthStateSecret
  })
  const tmdbConfigured = Boolean(config.tmdbAccessToken || config.tmdbApiKey)
  const d1Configured = Boolean(getD1Database(event))

  return {
    status: betaSeriesMissing.length === 0 && tmdbConfigured && d1Configured ? 'ready' : 'degraded',
    catalog: {
      provider: 'tmdb',
      configured: tmdbConfigured,
      missing: tmdbConfigured ? [] : ['NUXT_TMDB_ACCESS_TOKEN or NUXT_TMDB_API_KEY'],
      scheduleProvider: 'tvmaze'
    },
    books: {
      provider: 'openlibrary',
      configured: true,
      fallbackProvider: {
        provider: 'google-books',
        configured: Boolean(config.googleBooksApiKey),
        missing: config.googleBooksApiKey ? [] : ['NUXT_GOOGLE_BOOKS_API_KEY optional']
      }
    },
    storage: {
      persistentUserData: d1Configured,
      database: d1Configured,
      objectStorage: false
    },
    providers: [
      {
        id: 'betaseries',
        configured: betaSeriesMissing.length === 0,
        missing: betaSeriesMissing,
        capabilities: betaseriesCapabilities
      }
    ]
  }
})
