import { betaseriesCapabilities } from '~~/server/utils/betaseries-provider'

export default defineEventHandler((event) => {
  setNoStoreHeaders(event)

  const config = useRuntimeConfig(event)
  const missing = missingConfigKeys({
    NUXT_BETASERIES_API_KEY: config.betaseriesApiKey,
    NUXT_BETASERIES_CLIENT_SECRET: config.betaseriesClientSecret,
    NUXT_OAUTH_STATE_SECRET: config.oauthStateSecret
  })
  const configured = missing.length === 0

  return {
    providers: [
      {
        id: 'betaseries',
        name: 'BetaSeries',
        authMode: 'oauth2',
        configured,
        configuration: {
          ready: configured,
          missing
        },
        capabilities: betaseriesCapabilities
      }
    ]
  }
})
