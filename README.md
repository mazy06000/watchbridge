# SagaLog

SagaLog is a private tracking app and provider bridge for shows, movies, and books. It starts as a personal Trakt/TV Time-style tracker, expands into reading progress, and keeps import/provider-transfer work as onboarding features.

The first supported import path is TV Time GDPR ZIP into SagaLog. The first external transfer destination remains BetaSeries. The architecture stays provider-agnostic so future connectors can be sources, destinations, or both.

## What It Does

- Tracks private user libraries in Cloudflare D1.
- Searches and caches catalog metadata from TMDB.
- Uses TMDB `next_episode_to_air` and TVMaze fallback data for upcoming TV episode dates.
- Shows upcoming movie release dates when TMDB marks a movie as unreleased.
- Searches and caches book metadata from Open Library, with optional Google Books fallback.
- Tracks reading shelves, current page, total pages, reading percentage, and reading sessions.
- Parses TV Time GDPR ZIP files in the browser before normalized history is sent to the signed-in user's account.
- Keeps BetaSeries OAuth and transfer flows as a secondary provider bridge.
- Ships as an installable PWA with API responses excluded from service-worker caching.

## Architecture

The app follows a small DDD/VSA shape:

- `core/domain`: provider-neutral media, tracker, and migration language.
- `core/application`: use cases for catalog, library import, and provider transfer.
- `core/ports`: contracts for catalog providers, tracker repositories, and media providers.
- `server/utils/tmdb-catalog-provider.ts`: TMDB catalog adapter with TVMaze timing fallback.
- `server/utils/book-catalog-provider.ts`: Open Library book catalog adapter with Google Books fallback.
- `server/utils/book-repository.ts`: D1-backed reading repository with an in-memory dev fallback.
- `server/utils/tracker-repository.ts`: D1-backed tracker repository with an in-memory dev fallback.
- `server/utils/betaseries-*`: first destination provider adapter.
- `server/api/*`: thin Nuxt server routes that call use cases.
- `app/app.vue`: tracker dashboard, search, library, import, and provider transfer UI.

## Local Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Important environment variables:

```bash
NUXT_TMDB_ACCESS_TOKEN=
NUXT_TMDB_API_KEY=
NUXT_GOOGLE_BOOKS_API_KEY=
NUXT_AUTH_SECRET=
NUXT_RESEND_API_KEY=
NUXT_EMAIL_FROM=SagaLog <noreply@watchbridge.org>
NUXT_BETASERIES_API_KEY=
NUXT_BETASERIES_CLIENT_SECRET=
NUXT_OAUTH_STATE_SECRET=
NUXT_PUBLIC_APP_BASE_URL=http://localhost:3000
WATCHBRIDGE_USE_D1_DEV=0
```

Use `NUXT_TMDB_ACCESS_TOKEN` for TMDB's v4 read access token. `NUXT_TMDB_API_KEY` is a fallback for TMDB v3 API-key auth.

Open Library does not require a key. `NUXT_GOOGLE_BOOKS_API_KEY` is optional and is only used when Open Library returns no book results.

`NUXT_AUTH_SECRET` and `NUXT_OAUTH_STATE_SECRET` should each be at least 24 characters.

## Cloudflare D1

`wrangler.toml` expects a D1 binding named `DB`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "watchbridge"
database_id = "<cloudflare-d1-database-id>"
migrations_dir = "migrations"
```

Create the database in Cloudflare, replace `database_id`, then apply migrations:

```bash
npx wrangler d1 migrations apply watchbridge --local
npx wrangler d1 migrations apply watchbridge --remote
```

## Checks

```bash
npm run test
npm run typecheck
npm run build
```

## Cloudflare Pages

The project builds to `dist` with the Nitro `cloudflare_pages` preset.

Pages settings:

- Build command: `npm run build`
- Build output directory: `dist`
- Compatibility date: `2026-06-25`
- Production URL: `https://watchbridge.org`

The current Cloudflare project, D1 database, and production domain still use the original `watchbridge` identifiers until the infrastructure is migrated to a SagaLog domain.

Production public base URL:

```bash
NUXT_PUBLIC_APP_BASE_URL=https://watchbridge.org
```

Required production secrets:

```bash
wrangler pages secret put NUXT_TMDB_ACCESS_TOKEN --project-name watchbridge
wrangler pages secret put NUXT_GOOGLE_BOOKS_API_KEY --project-name watchbridge
wrangler pages secret put NUXT_AUTH_SECRET --project-name watchbridge
wrangler pages secret put NUXT_RESEND_API_KEY --project-name watchbridge
wrangler pages secret put NUXT_BETASERIES_API_KEY --project-name watchbridge
wrangler pages secret put NUXT_BETASERIES_CLIENT_SECRET --project-name watchbridge
wrangler pages secret put NUXT_OAUTH_STATE_SECRET --project-name watchbridge
```

The BetaSeries OAuth callback URL is:

```txt
https://watchbridge.org/api/providers/betaseries/callback
```

Readiness endpoint:

```txt
https://watchbridge.org/api/readiness
```

It reports only configuration key names and capability flags. It does not return secret values or user data.
