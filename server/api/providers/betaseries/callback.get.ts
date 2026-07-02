export default defineEventHandler(async (event) => {
  setNoStoreHeaders(event)
  setHeader(event, 'content-security-policy', "default-src 'none'; script-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'")

  const query = getQuery(event)
  const code = typeof query.code === 'string' ? query.code : ''
  const state = typeof query.state === 'string' ? query.state : ''

  if (!code || !state) {
    return callbackHtml({ origin: getRequestOrigin(event), error: 'Missing OAuth code or state.' })
  }

  try {
    const config = useRuntimeConfig(event)
    const payload = await verifyOAuthState(state, String(config.oauthStateSecret || ''))
    const token = await exchangeBetaSeriesCode(event, {
      code,
      redirectUri: `${payload.origin}/api/providers/betaseries/callback`
    })

    return callbackHtml({ origin: payload.origin, token })
  } catch (error) {
    return callbackHtml({
      origin: getRequestOrigin(event),
      error: error instanceof Error ? error.message : 'BetaSeries authentication failed.'
    })
  }
})

function callbackHtml(input: { origin: string, token?: string, error?: string }): string {
  const payload = JSON.stringify({
    type: 'watchbridge:provider-auth',
    provider: 'betaseries',
    accessToken: input.token,
    error: input.error
  })

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>BetaSeries connected</title></head>
<body>
<script>
window.opener && window.opener.postMessage(${payload}, ${JSON.stringify(input.origin)});
window.close();
</script>
</body>
</html>`
}
