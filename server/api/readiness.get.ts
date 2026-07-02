import { betaseriesCapabilities } from '~~/server/utils/betaseries-provider'

export default defineEventHandler((event) => {
  setNoStoreHeaders(event)

  const config = useRuntimeConfig(event)
  const betaSeriesMissing = missingConfigKeys({
    NUXT_BETASERIES_API_KEY: config.betaseriesApiKey,
    NUXT_BETASERIES_CLIENT_SECRET: config.betaseriesClientSecret,
    NUXT_OAUTH_STATE_SECRET: config.oauthStateSecret
  })

  return {
    status: betaSeriesMissing.length === 0 ? 'ready' : 'degraded',
    storage: {
      persistentUserData: false,
      database: false,
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
