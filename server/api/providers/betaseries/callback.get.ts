import type { H3Event } from 'h3'

export default defineEventHandler(async (event) => {
  setNoStoreHeaders(event)
  setHeader(event, 'content-security-policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'")

  const query = getQuery(event)
  const code = typeof query.code === 'string' ? query.code : ''
  const state = typeof query.state === 'string' && query.state
    ? query.state
    : readOAuthStateCookie(event)
  const oauthError = typeof query.error === 'string' ? query.error : ''
  const oauthErrorDescription = typeof query.error_description === 'string' ? query.error_description : ''

  clearOAuthStateCookie(event)

  if (oauthError) {
    return callbackHtml({
      origin: await resolveCallbackOrigin(event, state),
      error: oauthErrorDescription || oauthError
    })
  }

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
      origin: await resolveCallbackOrigin(event, state),
      error: error instanceof Error ? error.message : 'BetaSeries authentication failed.'
    })
  }
})

async function resolveCallbackOrigin(event: H3Event, state: string): Promise<string> {
  if (!state) {
    return getRequestOrigin(event)
  }

  try {
    const config = useRuntimeConfig(event)
    const payload = await verifyOAuthState(state, String(config.oauthStateSecret || ''))
    return payload.origin
  } catch {
    return getRequestOrigin(event)
  }
}

function callbackHtml(input: { origin: string, token?: string, error?: string }): string {
  const payload = JSON.stringify({
    type: 'watchbridge:provider-auth',
    provider: 'betaseries',
    accessToken: input.token,
    error: input.error
  })
  const statusTitle = input.token ? 'BetaSeries connected' : 'BetaSeries connection failed'
  const statusMessage = input.token
    ? 'You can close this window if it does not close automatically.'
    : input.error || 'BetaSeries authentication failed.'

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(statusTitle)}</title>
<style>
html{font-family:ui-sans-serif,system-ui,sans-serif;background:#fffdf8;color:#141815}
body{display:grid;min-height:100vh;margin:0;place-items:center;padding:24px}
main{max-width:560px;border:1px solid #ded9cd;border-radius:12px;background:white;padding:28px;box-shadow:0 18px 50px rgb(20 24 21 / 10%)}
h1{margin:0 0 12px;font-family:Georgia,serif;color:#123f35}
p{margin:0;line-height:1.6;color:#455149}
</style>
</head>
<body>
<main>
<h1>${escapeHtml(statusTitle)}</h1>
<p>${escapeHtml(statusMessage)}</p>
</main>
<script>
window.opener && window.opener.postMessage(${payload}, ${JSON.stringify(input.origin)});
${input.token ? 'setTimeout(() => window.close(), 300);' : ''}
</script>
</body>
</html>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
