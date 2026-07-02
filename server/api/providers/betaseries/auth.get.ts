export default defineEventHandler(async (event) => {
  setNoStoreHeaders(event)

  const { apiKey } = getBetaSeriesConfig(event)
  const config = useRuntimeConfig(event)
  const origin = getRequestOrigin(event)
  const redirectUri = `${origin}/api/providers/betaseries/callback`
  const state = await createOAuthState({ provider: 'betaseries', origin }, String(config.oauthStateSecret || ''))
  const authorizeUrl = new URL('https://www.betaseries.com/authorize')

  authorizeUrl.searchParams.set('client_id', apiKey)
  authorizeUrl.searchParams.set('redirect_uri', redirectUri)
  authorizeUrl.searchParams.set('state', state)

  await sendRedirect(event, authorizeUrl.toString(), 302)
})
