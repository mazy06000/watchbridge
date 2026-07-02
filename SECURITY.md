# Security

WatchBridge is designed to avoid retaining user media data.

## Data Handling

- The TV Time GDPR ZIP is parsed in the browser.
- Only selected CSV files are read.
- Sensitive CSV files are ignored by name and never sent to the server.
- Server routes do not use D1, KV, R2, Queues, Analytics Engine, or object storage.
- Transfer requests contain only normalized provider operations needed for matching/importing.

## OAuth

- BetaSeries OAuth state is signed with `NUXT_OAUTH_STATE_SECRET`.
- The OAuth callback sends the token back to the opener window with `postMessage`.
- The token is not written to a cookie, local storage, session storage, or a database.
- Import batches include the token only for the request being processed.

## Operational Requirements

- Disable request-body logging in any hosting/logging layer.
- Keep Cloudflare Web Analytics or third-party analytics away from import payload data.
- Set provider credentials as Cloudflare Pages environment variables, not source files.
- Rotate `NUXT_OAUTH_STATE_SECRET` and BetaSeries credentials if deployment logs or account access are exposed.
- Use `/api/readiness` to check deployment state; it reports missing key names but never secret values.

## Response Headers

The server sets conservative browser hardening headers, including `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, and HSTS. API routes also set `Cache-Control: no-store`.

## Supported Import Surface

The MVP supports TV Time GDPR exports into BetaSeries watched episodes, show library rows, watched movies, and movie list rows. Episode imports use exact episode IDs with bulk backfilling disabled. Movie watch rows become `seen`; movie list/follow rows become `to see`. Ratings, emotion votes, comments, friends, devices, login records, IP records, and tokens are intentionally out of scope.
