<template>
  <div class="app-shell min-h-screen selection:bg-[#153f35] selection:text-white">
    <div class="workspace mx-auto">
      <aside class="rail" aria-label="Migration state">
        <div class="brand">
          <div class="brand-mark" aria-hidden="true">
            <img src="/images/logo.png" alt="">
          </div>
          <div>
            <h1 class="brand-title">
              WatchBridge
            </h1>
            <p class="brand-subtitle">
              Tracking history transfer
            </p>
          </div>
        </div>

        <div class="step-list">
          <button
            v-for="step in steps"
            :key="step.id"
            class="step-item"
            :class="{ 'is-active': activeStep === step.id }"
            type="button"
            @click="activeStep = step.id"
          >
            <span class="step-index">0{{ step.index }}</span>
            <span class="step-copy">
              <span class="step-title">{{ step.title }}</span>
              <span class="step-meta">{{ step.meta }}</span>
            </span>
          </button>
        </div>

        <div class="privacy-stack">
          <p class="privacy-line">
            <ShieldCheck :size="17" />
            Browser-only ZIP parsing
          </p>
          <p class="privacy-line">
            <Database :size="17" />
            No app database
          </p>
          <p class="privacy-line">
            <LockKeyhole :size="17" />
            OAuth token in memory
          </p>
        </div>
      </aside>

      <main class="main-grid">
        <section class="hero-band">
          <div class="hero-copy">
            <div>
              <p class="hero-kicker">
                Private watch-history portability
              </p>
              <h2 class="hero-title">
                Move your watch history without losing the plot.
              </h2>
              <p class="hero-subtitle">
                WatchBridge turns exports from tracking apps into a reviewed, provider-neutral transfer plan. Your ZIP is parsed in your browser, matches stay visible, and nothing is stored by the app.
              </p>
            </div>
            <div class="hero-actions">
              <button class="btn btn-primary" type="button" @click="fileInput?.click()">
                <UploadCloud :size="18" />
                Select TV Time ZIP
              </button>
              <button
                class="btn"
                type="button"
                :disabled="!library"
                @click="resetWorkspace"
              >
                <RefreshCw :size="18" />
                Reset
              </button>
              <input
                ref="fileInput"
                class="hidden-input"
                type="file"
                accept=".zip,application/zip"
                @change="handleFileInput"
              >
            </div>
          </div>

          <div class="visual-panel" aria-label="Tracking provider transfer illustration">
            <div class="provider-flow-card">
              <span class="flow-label">Input providers</span>
              <strong>Bring history from any tracker</strong>
              <div class="provider-logo-grid">
                <div
                  v-for="item in sourceProviderLogos"
                  :key="`source-${item.id}`"
                  class="provider-logo-chip"
                >
                  <img :src="item.logo" :alt="item.name" @error="handleProviderLogoError">
                  <span>{{ item.name }}</span>
                </div>
              </div>
            </div>

            <div class="transfer-core">
              <LockKeyhole :size="20" />
              <span class="flow-label">WatchBridge core</span>
              <strong>Normalize, match, review</strong>
              <em>{{ transferPlan?.counts.total ?? 0 }} operations ready</em>
            </div>

            <div class="provider-flow-card">
              <span class="flow-label">Output providers</span>
              <strong>Send it to the place you choose</strong>
              <div class="provider-logo-grid">
                <div
                  v-for="item in destinationProviderLogos"
                  :key="`destination-${item.id}`"
                  class="provider-logo-chip"
                  :class="{ 'is-active': item.id === selectedProviderId }"
                >
                  <img :src="item.logo" :alt="item.name" @error="handleProviderLogoError">
                  <span>{{ item.name }}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="section-grid">
          <div class="surface">
            <div
              class="dropzone"
              :class="{ 'is-dragging': isDragging }"
              @dragenter.prevent="isDragging = true"
              @dragover.prevent="isDragging = true"
              @dragleave.prevent="isDragging = false"
              @drop.prevent="handleDrop"
            >
              <div class="dropzone-inner">
                <div class="dropzone-icon" aria-hidden="true">
                  <Archive :size="26" />
                </div>
                <div class="dropzone-copy">
                  <p class="dropzone-kicker">
                    Source archive
                  </p>
                  <h2>{{ library ? 'TV Time export loaded' : 'TV Time GDPR ZIP' }}</h2>
                  <p v-if="library">
                    Parsed {{ summary.watchedEpisodes }} episodes, {{ summary.shows }} shows, {{ summary.watchedMovies }} watched movies, and {{ summary.movieList }} movie list rows.
                  </p>
                  <p v-else>
                    Drop your TV Time GDPR export here, or choose the ZIP from disk. WatchBridge reads only the supported watch-history files in your browser.
                  </p>
                  <div class="button-row">
                    <button class="btn btn-primary" type="button" :disabled="isParsing" @click="fileInput?.click()">
                      <UploadCloud :size="18" />
                      {{ isParsing ? 'Parsing' : 'Choose ZIP' }}
                    </button>
                    <span v-if="parseError" class="badge badge-error">{{ parseError }}</span>
                    <span v-else-if="library" class="badge badge-success">Ready</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside class="panel">
            <h3 class="panel-title">
              Provider
            </h3>
            <div class="form-grid">
              <label class="field">
                <span>Destination provider</span>
                <select v-model="selectedProviderId">
                  <option value="betaseries">
                    BetaSeries
                  </option>
                </select>
              </label>

              <div class="provider-future" aria-label="Future destination providers">
                <span
                  v-for="item in connectorProviderLogos"
                  :key="item.id"
                  class="provider-mini-chip"
                >
                  <img :src="item.logo" :alt="item.name" @error="handleProviderLogoError">
                  {{ item.name }}
                </span>
                <span class="provider-mini-chip provider-mini-placeholder">More soon</span>
              </div>

              <div class="alert" :class="{ 'alert-error': provider && !provider.configured }">
                <Cloud :size="18" />
                <span>
                  {{ providerStatus }}
                </span>
              </div>

              <div class="button-row">
                <button
                  class="btn btn-primary"
                  type="button"
                  :disabled="!provider?.configured || isAuthPopupOpen"
                  @click="connectProvider"
                >
                  <KeyRound :size="18" />
                  {{ accessToken ? 'Reconnect' : 'Connect' }}
                </button>
                <button
                  class="btn"
                  type="button"
                  :disabled="!accessToken"
                  @click="disconnectProvider"
                >
                  <Unlink :size="18" />
                  Disconnect
                </button>
              </div>
            </div>
          </aside>
        </section>

        <section class="surface">
          <div class="toolbar">
            <div class="segmented" aria-label="Preview mode">
              <button
                v-for="mode in previewModes"
                :key="mode.id"
                class="segment"
                :class="{ 'is-active': previewMode === mode.id }"
                type="button"
                @click="setPreviewMode(mode.id)"
              >
                {{ mode.label }}
              </button>
            </div>
            <div class="button-row">
              <button
                class="btn"
                type="button"
                :disabled="!library || isMatching"
                @click="matchLibrary"
              >
                <Search :size="18" />
                {{ isMatching ? 'Matching' : 'Match' }}
              </button>
              <button
                class="btn btn-primary"
                type="button"
                :disabled="!canImport"
                @click="importMatchedOperations"
              >
                <Play :size="18" />
                {{ isImporting ? 'Importing' : 'Import matched' }}
              </button>
            </div>
          </div>

          <div class="stat-grid">
            <div class="stat-card">
              <strong>{{ transferPlan?.counts.episodes ?? 0 }}</strong>
              <span>episode operations</span>
            </div>
            <div class="stat-card">
              <strong>{{ transferPlan?.counts.shows ?? 0 }}</strong>
              <span>show library operations</span>
            </div>
            <div class="stat-card">
              <strong>{{ transferPlan?.counts.watchedMovies ?? 0 }}</strong>
              <span>movie watch operations</span>
            </div>
            <div class="stat-card">
              <strong>{{ matchedOperationCount }}</strong>
              <span>matched operations</span>
            </div>
          </div>

          <div v-if="isMatching || isImporting" class="mt-4">
            <div class="progress" aria-label="Progress">
              <span :style="{ width: `${Math.round(progress * 100)}%` }" />
            </div>
          </div>

          <div v-if="!library" class="empty-state">
            <p>No export loaded.</p>
          </div>

          <div v-else class="review-browser">
            <div class="review-heading">
              <div>
                <p class="eyebrow">
                  {{ previewMode === 'episodes' ? 'Grouped by show' : 'Preview' }}
                </p>
                <h3>
                  {{ previewMode === 'episodes' ? `${episodeGroups.length} shows` : `${activePreviewTotal} rows` }}
                </h3>
              </div>
              <p>
                Showing {{ previewRangeStart }}-{{ previewRangeEnd }} of {{ activePreviewTotal }}
              </p>
            </div>

            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{{ previewMode === 'episodes' ? 'Show' : 'Item' }}</th>
                    <th>Source</th>
                    <th>Target</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody v-if="previewMode === 'episodes'">
                  <template v-for="group in paginatedEpisodeGroups" :key="group.id">
                    <tr class="show-row">
                      <td>
                        <button class="show-toggle" type="button" @click="toggleEpisodeGroup(group.id)">
                          <ChevronDown
                            :size="18"
                            class="show-toggle-icon"
                            :class="{ 'is-open': isEpisodeGroupExpanded(group.id) }"
                          />
                          <span class="show-copy">
                            <strong>{{ group.title }}</strong>
                            <span class="show-stats">{{ group.total }} episodes · {{ group.matched }} matched</span>
                          </span>
                        </button>
                      </td>
                      <td>{{ group.latestWatchedAt }}</td>
                      <td>{{ group.target || 'Not matched' }}</td>
                      <td>
                        <span class="badge" :class="group.badgeClass">{{ group.status }}</span>
                      </td>
                    </tr>
                    <tr v-if="isEpisodeGroupExpanded(group.id)" class="episode-detail-row">
                      <td colspan="4">
                        <div class="episode-list">
                          <div v-for="episode in group.rows" :key="episode.id" class="episode-row">
                            <span class="episode-title">{{ episode.title }}</span>
                            <span>{{ episode.source }}</span>
                            <span>{{ episode.target || 'Not matched' }}</span>
                            <span class="badge" :class="episode.badgeClass">{{ episode.status }}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </template>
                </tbody>
                <tbody v-else>
                  <tr v-for="row in paginatedPreviewRows" :key="row.id">
                    <td>{{ row.title }}</td>
                    <td>{{ row.source }}</td>
                    <td>{{ row.target || 'Not matched' }}</td>
                    <td>
                      <span class="badge" :class="row.badgeClass">{{ row.status }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div v-if="totalPreviewPages > 1" class="pagination">
              <button class="page-btn" type="button" :disabled="currentPreviewPage === 1" @click="setPreviewPage(currentPreviewPage - 1)">
                <ChevronLeft :size="17" />
                Previous
              </button>
              <div class="page-track" aria-label="Preview pages">
                <button
                  v-for="page in visiblePreviewPages"
                  :key="page"
                  class="page-number"
                  :class="{ 'is-active': page === currentPreviewPage }"
                  type="button"
                  @click="setPreviewPage(page)"
                >
                  {{ page }}
                </button>
              </div>
              <p class="page-summary">
                Page {{ currentPreviewPage }} of {{ totalPreviewPages }}
              </p>
              <button class="page-btn" type="button" :disabled="currentPreviewPage === totalPreviewPages" @click="setPreviewPage(currentPreviewPage + 1)">
                Next
                <ChevronRight :size="17" />
              </button>
            </div>
          </div>
        </section>

        <section class="section-grid">
          <div class="panel">
            <h3 class="panel-title">
              Import Log
            </h3>
            <div v-if="logLines.length === 0" class="empty-state">
              <p>No operations run.</p>
            </div>
            <div v-else class="log-list">
              <div v-for="line in logLines" :key="line.id" class="log-line">
                <span class="badge" :class="line.badgeClass">{{ line.status }}</span>
                <span>{{ line.message }}</span>
              </div>
            </div>
          </div>

          <div class="panel">
            <h3 class="panel-title">
              Safety Gates
            </h3>
            <p class="panel-note">
              WatchBridge moves tracking history, not streaming accounts or subscriptions.
            </p>
            <ul class="checklist">
              <li>
                <CheckCircle2 :size="17" />
                <span>ZIP file is never posted to the server.</span>
              </li>
              <li>
                <CheckCircle2 :size="17" />
                <span>Server routes return `Cache-Control: no-store`.</span>
              </li>
              <li>
                <CheckCircle2 :size="17" />
                <span>Provider API secret remains server-side.</span>
              </li>
              <li>
                <CheckCircle2 :size="17" />
                <span>Imports run in batches of {{ IMPORT_BATCH_SIZE }} operations.</span>
              </li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Archive,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Database,
  KeyRound,
  LockKeyhole,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Unlink,
  UploadCloud
} from '@lucide/vue'
import { stableMediaId, type NormalizedLibrary } from '~~/core/domain/media'
import type {
  ImportResultLine,
  ProviderDescriptor,
  ProviderMovieMatch,
  ProviderShowMatch
} from '~~/core/domain/migration'
import type {
  ProviderImportOperation,
  ProviderMovieMatchRequest,
  ProviderShowMatchRequest
} from '~~/core/ports/media-provider'
import { buildTransferPlan, summarizeLibrary } from '~~/core/application/build-transfer-plan'

type StepId = 'import' | 'match' | 'transfer'
type PreviewMode = 'episodes' | 'movies' | 'diagnostics'

interface PreviewRow {
  id: string
  title: string
  source: string
  target?: string
  status: string
  badgeClass: string
}

interface EpisodePreviewGroup {
  id: string
  title: string
  target?: string
  status: string
  badgeClass: string
  latestWatchedAt: string
  total: number
  matched: number
  rows: PreviewRow[]
}

interface LogLine {
  id: string
  status: string
  message: string
  badgeClass: string
}

interface AuthMessage {
  type?: string
  provider?: string
  accessToken?: string
  error?: string
}

type AuthPopupWindow = Window & {
  __WATCHBRIDGE_AUTH_RESULT__?: AuthMessage
}

interface ProvidersResponse {
  providers: ProviderDescriptor[]
}

interface ProviderLogoItem {
  id: string
  name: string
  logo: string
}

const MATCH_SHOW_BATCH_SIZE = 8
const MATCH_MOVIE_BATCH_SIZE = 20
const IMPORT_BATCH_SIZE = 25
const PREVIEW_PAGE_SIZE = 12

const providerLogoRegistry: ProviderLogoItem[] = [
  { id: 'tv-time', name: 'TV Time', logo: '/providers/tv-time.png' },
  { id: 'betaseries', name: 'BetaSeries', logo: '/providers/betaseries.png' },
  { id: 'trakt', name: 'Trakt', logo: '/providers/trakt.png' },
  { id: 'serializd', name: 'Serializd', logo: '/providers/serializd.png' }
]

const sourceProviderLogos = providerLogoRegistry.filter((item) =>
  ['tv-time', 'trakt', 'serializd'].includes(item.id)
)
const destinationProviderLogos = providerLogoRegistry.filter((item) =>
  ['betaseries', 'trakt', 'serializd'].includes(item.id)
)
const connectorProviderLogos = providerLogoRegistry.filter((item) => item.id !== 'tv-time')

const fallbackCapabilities = {
  watchedEpisodes: true,
  watchedMovies: true,
  showLibrary: true,
  movieWatchlist: true,
  ratings: false,
  watchedAt: false,
  rewatches: false
}

const fileInput = ref<HTMLInputElement | null>(null)
const library = shallowRef<NormalizedLibrary | null>(null)
const providers = ref<ProviderDescriptor[]>([])
const selectedProviderId = ref('betaseries')
const accessToken = ref('')
const parseError = ref('')
const activeStep = ref<StepId>('import')
const previewMode = ref<PreviewMode>('episodes')
const previewPage = ref(1)
const isDragging = ref(false)
const isParsing = ref(false)
const isMatching = ref(false)
const isImporting = ref(false)
const isAuthPopupOpen = ref(false)
const progress = ref(0)
const showMatches = ref<ProviderShowMatch[]>([])
const movieMatches = ref<ProviderMovieMatch[]>([])
const importResults = ref<ImportResultLine[]>([])
const logLines = ref<LogLine[]>([])
const expandedEpisodeGroupIds = ref<Set<string>>(new Set())
let authPopupPollTimer: ReturnType<typeof setInterval> | undefined

const provider = computed(() => providers.value.find((item) => item.id === selectedProviderId.value))
const providerCapabilities = computed(() => provider.value?.capabilities ?? fallbackCapabilities)
const transferPlan = computed(() => library.value ? buildTransferPlan(library.value, providerCapabilities.value) : null)
const summary = computed(() => library.value
  ? summarizeLibrary(library.value)
  : {
      watchedEpisodes: 0,
      shows: 0,
      watchedMovies: 0,
      movieList: 0,
      warnings: 0
    })

const providerStatus = computed(() => {
  if (!provider.value) {
    return 'Provider configuration loading.'
  }
  if (!provider.value.configured) {
    const missing = provider.value.configuration?.missing ?? []
    return missing.length > 0
      ? `Missing ${missing.join(', ')}.`
      : 'BetaSeries environment variables are missing.'
  }
  if (accessToken.value) {
    return 'BetaSeries connected for this browser session.'
  }
  return 'BetaSeries ready for OAuth.'
})

const steps = computed(() => [
  {
    id: 'import' as const,
    index: 1,
    title: 'Import',
    meta: library.value ? `${summary.value.watchedEpisodes} episodes` : 'Waiting for ZIP'
  },
  {
    id: 'match' as const,
    index: 2,
    title: 'Match',
    meta: showMatches.value.length || movieMatches.value.length
      ? `${matchedOperationCount.value} ready`
      : 'Not matched'
  },
  {
    id: 'transfer' as const,
    index: 3,
    title: 'Transfer',
    meta: importResults.value.length ? `${importResults.value.length} results` : 'Not started'
  }
])

const previewModes = [
  { id: 'episodes' as const, label: 'Episodes' },
  { id: 'movies' as const, label: 'Movies' },
  { id: 'diagnostics' as const, label: 'Diagnostics' }
]

const matchedEpisodeIds = computed(() => new Map(
  showMatches.value.flatMap((show) => show.episodes)
    .filter((episode) => episode.providerEpisodeId)
    .map((episode) => [episode.sourceEpisodeId, episode.providerEpisodeId!])
))

const matchedShowIds = computed(() => new Map(
  showMatches.value
    .filter((show) => show.providerShowId)
    .map((show) => [show.sourceShowId, show.providerShowId!])
))

const matchedMovieIds = computed(() => new Map(
  movieMatches.value
    .filter((movie) => movie.providerMovieId)
    .map((movie) => [movie.sourceMovieId, movie.providerMovieId!])
))

const showMatchesBySourceId = computed(() => new Map(
  showMatches.value.map((show) => [show.sourceShowId, show])
))

const movieMatchesBySourceId = computed(() => new Map(
  movieMatches.value.map((movie) => [movie.sourceMovieId, movie])
))

const matchedOperationCount = computed(() => buildProviderOperations().length)
const canImport = computed(() =>
  Boolean(accessToken.value && !isMatching.value && !isImporting.value && matchedOperationCount.value > 0)
)

const episodeGroups = computed<EpisodePreviewGroup[]>(() => {
  if (!library.value) {
    return []
  }

  const groups = new Map<string, {
    id: string
    title: string
    latestWatchedAt?: string
    rows: PreviewRow[]
  }>()

  for (const episode of library.value.watchedEpisodes) {
    const key = sourceShowKey(episode)
    const showMatch = showMatchesBySourceId.value.get(key)
    const existing = groups.get(key) ?? {
      id: key,
      title: episode.showTitle,
      rows: []
    }

    existing.latestWatchedAt = maxIsoDate(existing.latestWatchedAt, episode.watchedAt)
    existing.rows.push({
      id: episode.id,
      title: `S${episode.seasonNumber}E${episode.episodeNumber}`,
      source: episode.watchedAt?.slice(0, 10) ?? 'TV Time episode',
      target: showMatch?.providerTitle,
      status: matchedEpisodeIds.value.has(episode.id) ? 'matched' : 'pending',
      badgeClass: matchedEpisodeIds.value.has(episode.id) ? 'badge-success' : 'badge-warn'
    })

    groups.set(key, existing)
  }

  return [...groups.values()]
    .map((group) => {
      const showMatch = showMatchesBySourceId.value.get(group.id)
      const matched = group.rows.filter((row) => row.status === 'matched').length
      const hasError = showMatch?.status === 'error' || group.rows.some((row) => row.status === 'error')
      const status = hasError
        ? 'error'
        : matched === group.rows.length
          ? 'matched'
          : matched > 0
            ? 'partial'
            : 'pending'

      return {
        id: group.id,
        title: group.title,
        target: showMatch?.providerTitle,
        status,
        badgeClass: hasError ? 'badge-error' : status === 'matched' ? 'badge-success' : 'badge-warn',
        latestWatchedAt: group.latestWatchedAt?.slice(0, 10) ?? 'TV Time episode',
        total: group.rows.length,
        matched,
        rows: [...group.rows].sort(compareEpisodeRows)
      }
    })
    .sort((first, second) => first.title.localeCompare(second.title))
})

const previewRows = computed<PreviewRow[]>(() => {
  if (!library.value) {
    return []
  }

  if (previewMode.value === 'diagnostics') {
    return library.value.diagnostics.map((diagnostic) => ({
      id: diagnostic.code,
      title: diagnostic.message,
      source: diagnostic.code,
      target: diagnostic.count ? String(diagnostic.count) : '',
      status: diagnostic.severity,
      badgeClass: diagnostic.severity === 'error'
        ? 'badge-error'
        : diagnostic.severity === 'warning'
          ? 'badge-warn'
          : 'badge-success'
    }))
  }

  if (previewMode.value === 'movies') {
    return [
      ...library.value.watchedMovies.map((movie) => ({
        id: movie.id,
        title: movie.title,
        source: movie.releaseDate ?? 'TV Time movie',
        target: movieMatchesBySourceId.value.get(movie.id)?.providerTitle,
        status: matchedMovieIds.value.has(movie.id) ? 'matched' : 'pending',
        badgeClass: matchedMovieIds.value.has(movie.id) ? 'badge-success' : 'badge-warn'
      })),
      ...library.value.movieList.map((movie) => ({
        id: movie.id,
        title: movie.title,
        source: movie.state,
        target: movieMatchesBySourceId.value.get(movie.id)?.providerTitle,
        status: matchedMovieIds.value.has(movie.id) ? 'matched' : 'pending',
        badgeClass: matchedMovieIds.value.has(movie.id) ? 'badge-success' : 'badge-warn'
      }))
    ]
  }

  return []
})

const activePreviewTotal = computed(() =>
  previewMode.value === 'episodes' ? episodeGroups.value.length : previewRows.value.length
)

const totalPreviewPages = computed(() =>
  Math.max(1, Math.ceil(activePreviewTotal.value / PREVIEW_PAGE_SIZE))
)

const currentPreviewPage = computed(() =>
  Math.min(previewPage.value, totalPreviewPages.value)
)

const previewSliceStart = computed(() => (currentPreviewPage.value - 1) * PREVIEW_PAGE_SIZE)
const previewRangeStart = computed(() => activePreviewTotal.value === 0 ? 0 : previewSliceStart.value + 1)
const previewRangeEnd = computed(() =>
  Math.min(previewSliceStart.value + PREVIEW_PAGE_SIZE, activePreviewTotal.value)
)

const paginatedEpisodeGroups = computed(() =>
  episodeGroups.value.slice(previewSliceStart.value, previewSliceStart.value + PREVIEW_PAGE_SIZE)
)

const paginatedPreviewRows = computed(() =>
  previewRows.value.slice(previewSliceStart.value, previewSliceStart.value + PREVIEW_PAGE_SIZE)
)

const visiblePreviewPages = computed(() => {
  const start = Math.max(1, currentPreviewPage.value - 2)
  const end = Math.min(totalPreviewPages.value, start + 4)
  const adjustedStart = Math.max(1, end - 4)
  return Array.from({ length: end - adjustedStart + 1 }, (_, index) => adjustedStart + index)
})

onMounted(async () => {
  window.addEventListener('message', handleAuthMessage)
  try {
    const response = await $fetch<ProvidersResponse>('/api/providers')
    providers.value = response.providers
  } catch (error) {
    pushLog('failed', error instanceof Error ? error.message : 'Provider discovery failed.')
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('message', handleAuthMessage)
  clearAuthPopupWatch()
})

function setPreviewMode(mode: PreviewMode): void {
  previewMode.value = mode
  previewPage.value = 1
}

function setPreviewPage(page: number): void {
  previewPage.value = Math.min(Math.max(page, 1), totalPreviewPages.value)
}

function isEpisodeGroupExpanded(groupId: string): boolean {
  return expandedEpisodeGroupIds.value.has(groupId)
}

function toggleEpisodeGroup(groupId: string): void {
  const next = new Set(expandedEpisodeGroupIds.value)
  if (next.has(groupId)) {
    next.delete(groupId)
  } else {
    next.add(groupId)
  }
  expandedEpisodeGroupIds.value = next
}

function sourceShowKey(episode: NormalizedLibrary['watchedEpisodes'][number]): string {
  return episode.source.showId
    ? stableMediaId(['tvtime', 'show', episode.source.showId])
    : `title-${episode.showTitle.toLowerCase()}`
}

function maxIsoDate(current: string | undefined, next: string | undefined): string | undefined {
  if (!next) {
    return current
  }
  if (!current) {
    return next
  }
  return next > current ? next : current
}

function compareEpisodeRows(first: PreviewRow, second: PreviewRow): number {
  return first.title.localeCompare(second.title, undefined, { numeric: true })
}

function handleAuthMessage(event: MessageEvent): void {
  if (event.origin !== window.location.origin) {
    return
  }

  const data = event.data as AuthMessage
  if (data.type !== 'watchbridge:provider-auth' || data.provider !== 'betaseries') {
    return
  }

  completeProviderAuth(data)
}

function completeProviderAuth(data: AuthMessage): void {
  clearAuthPopupWatch()
  isAuthPopupOpen.value = false
  if (data.error) {
    pushLog('failed', data.error)
    return
  }

  if (data.accessToken) {
    accessToken.value = data.accessToken
    activeStep.value = 'transfer'
    pushLog('success', 'BetaSeries connected.')
  }
}

function handleFileInput(event: Event): void {
  const input = event.target as HTMLInputElement
  void parseFile(input.files?.[0])
  input.value = ''
}

function handleDrop(event: DragEvent): void {
  isDragging.value = false
  void parseFile(event.dataTransfer?.files?.[0])
}

async function parseFile(file: File | undefined): Promise<void> {
  if (!file) {
    return
  }

  isParsing.value = true
  parseError.value = ''
  resetMatches()

  try {
    const { readTvTimeGdprZip } = await import('~~/infra/sources/tvtime-gdpr-reader')
    library.value = await readTvTimeGdprZip(file)
    activeStep.value = 'match'
    setPreviewMode('episodes')
    expandedEpisodeGroupIds.value = new Set()
    pushLog('success', `Loaded ${file.name}.`)
  } catch (error) {
    library.value = null
    parseError.value = error instanceof Error ? error.message : 'Import failed.'
    pushLog('failed', parseError.value)
  } finally {
    isParsing.value = false
  }
}

function connectProvider(): void {
  clearAuthPopupWatch()
  isAuthPopupOpen.value = true
  const popup = window.open(
    '/api/providers/betaseries/auth',
    'betaseries-oauth',
    'popup,width=680,height=780,noopener=false'
  )

  if (!popup) {
    isAuthPopupOpen.value = false
    pushLog('failed', 'Popup was blocked.')
    return
  }

  watchAuthPopup(popup as AuthPopupWindow)
}

function disconnectProvider(): void {
  clearAuthPopupWatch()
  accessToken.value = ''
  pushLog('success', 'Provider disconnected.')
}

function watchAuthPopup(popup: AuthPopupWindow): void {
  authPopupPollTimer = setInterval(() => {
    if (popup.closed) {
      clearAuthPopupWatch()
      isAuthPopupOpen.value = false
      return
    }

    try {
      const result = popup.__WATCHBRIDGE_AUTH_RESULT__
      if (result?.type === 'watchbridge:provider-auth' && result.provider === 'betaseries') {
        try {
          popup.close()
        } catch {
          // The popup may already be closing.
        }
        completeProviderAuth(result)
      }
    } catch {
      // Cross-origin while the popup is still on BetaSeries.
    }
  }, 250)
}

function clearAuthPopupWatch(): void {
  if (!authPopupPollTimer) {
    return
  }
  clearInterval(authPopupPollTimer)
  authPopupPollTimer = undefined
}

function handleProviderLogoError(event: Event): void {
  const image = event.currentTarget as HTMLImageElement
  image.hidden = true
}

async function matchLibrary(): Promise<void> {
  if (!library.value || isMatching.value) {
    return
  }

  resetMatches()
  isMatching.value = true
  progress.value = 0
  activeStep.value = 'match'

  const showRequests = buildShowMatchRequests(library.value)
  const movieRequests = buildMovieMatchRequests(library.value)
  const totalBatches = Math.max(
    Math.ceil(showRequests.length / MATCH_SHOW_BATCH_SIZE),
    Math.ceil(movieRequests.length / MATCH_MOVIE_BATCH_SIZE),
    1
  )

  try {
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex += 1) {
      const response = await $fetch<{
        shows: ProviderShowMatch[]
        movies: ProviderMovieMatch[]
      }>('/api/providers/betaseries/match', {
        method: 'POST',
        body: {
          shows: showRequests.slice(batchIndex * MATCH_SHOW_BATCH_SIZE, (batchIndex + 1) * MATCH_SHOW_BATCH_SIZE),
          movies: movieRequests.slice(batchIndex * MATCH_MOVIE_BATCH_SIZE, (batchIndex + 1) * MATCH_MOVIE_BATCH_SIZE)
        }
      })

      showMatches.value.push(...response.shows)
      movieMatches.value.push(...response.movies)
      progress.value = (batchIndex + 1) / totalBatches
      await wait(180)
    }

    pushLog('success', `Matched ${matchedOperationCount.value} import operations.`)
  } catch (error) {
    pushLog('failed', error instanceof Error ? error.message : 'Matching failed.')
  } finally {
    isMatching.value = false
  }
}

async function importMatchedOperations(): Promise<void> {
  if (!canImport.value || isImporting.value) {
    return
  }

  isImporting.value = true
  progress.value = 0
  activeStep.value = 'transfer'
  importResults.value = []

  const operations = buildProviderOperations()
  const batches = chunk(operations, IMPORT_BATCH_SIZE)

  try {
    for (let index = 0; index < batches.length; index += 1) {
      const response = await $fetch<{ results: ImportResultLine[] }>('/api/providers/betaseries/import', {
        method: 'POST',
        body: {
          accessToken: accessToken.value,
          operations: batches[index]
        }
      })

      importResults.value.push(...response.results)
      for (const result of response.results) {
        pushLog(result.status === 'success' ? 'success' : 'failed', result.message)
      }
      progress.value = (index + 1) / batches.length
      await wait(220)
    }
  } catch (error) {
    pushLog('failed', error instanceof Error ? error.message : 'Import failed.')
  } finally {
    isImporting.value = false
  }
}

function resetWorkspace(): void {
  library.value = null
  parseError.value = ''
  importResults.value = []
  logLines.value = []
  progress.value = 0
  setPreviewMode('episodes')
  expandedEpisodeGroupIds.value = new Set()
  resetMatches()
  activeStep.value = 'import'
}

function resetMatches(): void {
  showMatches.value = []
  movieMatches.value = []
  importResults.value = []
}

function buildShowMatchRequests(source: NormalizedLibrary): ProviderShowMatchRequest[] {
  const grouped = new Map<string, ProviderShowMatchRequest>()

  for (const show of source.shows) {
    grouped.set(show.id, {
      sourceShowId: show.id,
      title: show.title,
      episodes: []
    })
  }

  for (const episode of source.watchedEpisodes) {
    const key = sourceShowKey(episode)
    const existing = grouped.get(key) ?? {
      sourceShowId: key,
      title: episode.showTitle,
      episodes: []
    }
    existing.episodes.push({
      sourceEpisodeId: episode.id,
      seasonNumber: episode.seasonNumber,
      episodeNumber: episode.episodeNumber
    })
    grouped.set(key, existing)
  }

  return [...grouped.values()].filter((show) => show.episodes.length > 0 || show.title)
}

function buildMovieMatchRequests(source: NormalizedLibrary): ProviderMovieMatchRequest[] {
  const grouped = new Map<string, ProviderMovieMatchRequest>()

  for (const movie of source.watchedMovies) {
    grouped.set(movie.id, {
      sourceMovieId: movie.id,
      title: movie.title,
      releaseDate: movie.releaseDate
    })
  }

  for (const movie of source.movieList) {
    grouped.set(movie.id, {
      sourceMovieId: movie.id,
      title: movie.title,
      releaseDate: movie.releaseDate
    })
  }

  return [...grouped.values()]
}

function buildProviderOperations(): ProviderImportOperation[] {
  if (!transferPlan.value) {
    return []
  }

  const operations: ProviderImportOperation[] = []

  for (const operation of transferPlan.value.operations) {
    if (operation.kind === 'episode-watched') {
      const providerId = matchedEpisodeIds.value.get(operation.item.id)
      if (providerId) {
        operations.push({
          operationId: operation.id,
          kind: operation.kind,
          providerId,
          state: 'watched'
        })
      }
    } else if (operation.kind === 'show-library') {
      const providerId = matchedShowIds.value.get(operation.item.id)
      if (providerId) {
        operations.push({
          operationId: operation.id,
          kind: operation.kind,
          providerId,
          state: 'followed'
        })
      }
    } else if (operation.kind === 'movie-watched') {
      const providerId = matchedMovieIds.value.get(operation.item.id)
      if (providerId) {
        operations.push({
          operationId: operation.id,
          kind: operation.kind,
          providerId,
          state: 'watched'
        })
      }
    } else if (operation.kind === 'movie-list') {
      const providerId = matchedMovieIds.value.get(operation.item.id)
      if (providerId) {
        operations.push({
          operationId: operation.id,
          kind: operation.kind,
          providerId,
          state: operation.item.state
        })
      }
    }
  }

  return operations
}

function pushLog(status: 'success' | 'failed' | 'skipped', message: string): void {
  logLines.value.unshift({
    id: crypto.randomUUID(),
    status,
    message,
    badgeClass: status === 'success' ? 'badge-success' : status === 'failed' ? 'badge-error' : 'badge-warn'
  })
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size))
  }
  return batches
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}
</script>
