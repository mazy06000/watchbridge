# WatchBridge

Private TV show and movie transfer between media-tracking services, built with Nuxt and Cloudflare Pages.

The first supported path is TV Time GDPR export to BetaSeries. The product direction is broader: every provider should be able to become a source, a destination, or both when its API/export format allows it.

## What It Does

- Normalizes watch-history and list data into provider-neutral TV show and movie objects.
- Current source connector: parses the TV Time GDPR ZIP in the browser.
- Current destination connector: imports matched items into BetaSeries.
- Reads only the TV Time files needed for transfer: `tracking-prod-records-v2.csv`, `user_tv_show_data.csv`, and `tracking-prod-records.csv`.
- Ignores sensitive export files such as tokens, IP addresses, devices, login records, and social data.
- Matches media against the selected destination provider through server routes that keep provider API secrets private.
- Imports matched items in small batches without writing user data to D1, KV, R2, logs, or a database.
- Keeps provider-specific behavior inside provider adapters.

## Provider Direction

WatchBridge is designed around a normalized library model:

```txt
source provider/export -> normalized library -> transfer plan -> destination provider
```

Today, the only implemented source is TV Time GDPR export and the only implemented destination is BetaSeries. Future connectors can support one or both directions:

- source-only: read an export or API and normalize it;
- destination-only: match and import normalized media;
- bidirectional: both read from and write to the same provider.

BetaSeries-specific rules currently live in its adapter: watched episodes are marked with `bulk=false` to avoid backfilling unwatched previous episodes, watched movies map to `seen`, and movie list/follow rows map to `to see`.

## Architecture

The app uses a small ports/adapters design:

- `core/domain`: normalized media and migration language.
- `core/application`: provider-aware transfer-plan rules.
- `core/ports`: provider contracts for matching and imports.
- `infra/sources`: source readers, currently the TV Time GDPR ZIP reader.
- `server/utils/betaseries-*`: first destination provider adapter.
- `server/api/providers/*`: OAuth, matching, import, and provider discovery routes for destination connectors.
- `app/app.vue`: vertical-slice UI for import, match, transfer, and progress.

Adding a destination provider should mean implementing the provider port and adding server routes for its OAuth/import flow. Adding a source provider should mean implementing a reader that returns the same normalized library shape used by the rest of the app.

## Local Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Required environment variables:

```bash
NUXT_BETASERIES_API_KEY=
NUXT_BETASERIES_CLIENT_SECRET=
NUXT_OAUTH_STATE_SECRET=
NUXT_PUBLIC_APP_BASE_URL=http://localhost:3000
```

`NUXT_OAUTH_STATE_SECRET` must be at least 24 characters.

## Checks

```bash
npm run test
npm run typecheck
npm run lint
npm run build
```

## Cloudflare Pages

The project builds to `dist` with the Nitro `cloudflare_pages` preset.

Suggested Pages project:

- Project: `watchbridge`
- Production URL: `https://watchbridge.org`

Cloudflare Pages settings:

- Build command: `npm run build`
- Build output directory: `dist`
- Compatibility date: `2026-06-25`
- Environment variables: the same `NUXT_*` variables listed above

Production public base URL:

```bash
NUXT_PUBLIC_APP_BASE_URL=https://watchbridge.org
```

Direct deploy:

```bash
npm run deploy
```

Production secrets for the first BetaSeries connector:

```bash
wrangler pages secret put NUXT_BETASERIES_API_KEY --project-name watchbridge
wrangler pages secret put NUXT_BETASERIES_CLIENT_SECRET --project-name watchbridge
wrangler pages secret put NUXT_OAUTH_STATE_SECRET --project-name watchbridge
```

The OAuth callback URL to register in the BetaSeries developer app is:

```txt
https://watchbridge.org/api/providers/betaseries/callback
```

Readiness endpoint:

```txt
https://watchbridge.org/api/readiness
```

It reports only configuration key names and capability flags. It does not return secret values or user data.

Preview the production output locally:

```bash
npm run preview
```

## Security Model

No persistent storage is configured. Source exports are parsed on the client when possible, and only normalized transfer payloads are sent to provider routes. Server API routes set `Cache-Control: no-store`; OAuth state is signed with HMAC; provider API credentials stay server-side; user provider tokens are held in browser memory for the current session.
