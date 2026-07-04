<template>
  <div class="tracker-shell">
    <aside class="side-nav">
      <div class="brand-lockup">
        <div>
          <p class="brand-name">
            SagaLog
          </p>
          <p class="brand-caption">
            Personal media tracker
          </p>
        </div>
      </div>

      <nav class="nav-stack" aria-label="Primary">
        <button
          v-for="item in navigation"
          :key="item.id"
          class="nav-item"
          :class="{ 'is-active': activeView === item.id }"
          type="button"
          @click="activeView = item.id"
        >
          <component :is="item.icon" :size="18" />
          <span>{{ item.label }}</span>
        </button>
      </nav>

      <div class="auth-card">
        <div v-if="me" class="account-chip">
          <div class="avatar">
            {{ initials }}
          </div>
          <div>
            <strong>{{ me.displayName || 'Signed in' }}</strong>
            <span>{{ me.email }}</span>
          </div>
        </div>
        <form v-else class="signin-form" @submit.prevent="requestSignin">
          <label>
            <span>Email magic link</span>
            <input v-model="email" type="email" placeholder="you@example.com" autocomplete="email">
          </label>
          <button class="btn btn-primary" type="submit" :disabled="isRequestingLink">
            <Mail :size="17" />
            {{ isRequestingLink ? 'Sending' : 'Send link' }}
          </button>
          <a v-if="devMagicLink" class="dev-link" :href="devMagicLink">
            Open dev magic link
          </a>
        </form>
        <button v-if="me" class="btn btn-ghost w-full" type="button" @click="logoutUser">
          <LogOut :size="17" />
          Sign out
        </button>
      </div>
    </aside>

    <main class="app-main">
      <header class="topbar">
        <div>
          <p class="eyebrow">
            {{ currentViewLabel }}
          </p>
          <h1>{{ currentHeadline }}</h1>
        </div>
        <form class="quick-search" @submit.prevent="activeView === 'books' ? runBookSearch() : runSearch()">
          <Search :size="18" />
          <input v-if="activeView === 'books'" v-model="bookSearchQuery" type="search" placeholder="Search books">
          <input v-else v-model="searchQuery" type="search" placeholder="Search TMDB catalog">
          <button type="submit">
            Search
          </button>
        </form>
      </header>

      <section v-if="activeView === 'home'" class="view-stack">
        <div class="cinema-hero">
          <div class="hero-copy">
            <p class="hero-kicker">
              Your media history, in one place
            </p>
            <h2>Your private library for shows, movies, and books.</h2>
            <p>
              Search TMDB and Open Library, build your queue, see upcoming releases, and import old TV Time history without sending your archive to a server first.
            </p>
            <div class="hero-actions">
              <button class="btn btn-primary" type="button" @click="activeView = 'search'">
                <Search :size="18" />
                Find something
              </button>
              <button class="btn btn-ghost" type="button" @click="activeView = 'import'">
                <UploadCloud :size="18" />
                Import history
              </button>
              <button class="btn btn-ghost" type="button" @click="activeView = 'books'">
                <BookOpen :size="18" />
                Track books
              </button>
            </div>
          </div>
          <div class="hero-poster-wall" aria-hidden="true">
            <article
              v-for="card in heroCards"
              :key="card.title"
              class="poster-tile"
              :style="{ '--poster-accent': card.color }"
            >
              <span>{{ card.type }}</span>
              <strong>{{ card.title }}</strong>
            </article>
          </div>
        </div>

        <div class="stat-strip">
          <div v-for="stat in dashboardStats" :key="stat.label" class="metric-card">
            <strong>{{ stat.value }}</strong>
            <span>{{ stat.label }}</span>
          </div>
        </div>

        <section class="rail-section">
          <div class="section-heading">
            <h2>Continue watching</h2>
            <p>{{ dashboard?.continueWatching.length ?? 0 }} active titles</p>
          </div>
          <div class="poster-rail">
            <TitleCard
              v-for="item in dashboard?.continueWatching"
              :key="item.title.id"
              :title="item.title"
              :meta="item.status"
              @open="openTitle(item.title)"
              @watch="markWatched(item.title)"
              @add="addToLibrary(item.title, 'watchlist')"
            />
            <EmptyRail v-if="!dashboard?.continueWatching.length" label="Start tracking a title to build this rail." />
          </div>
        </section>

        <section class="rail-section">
          <div class="section-heading">
            <h2>Your watchlist</h2>
            <p>{{ dashboard?.watchlist.length ?? 0 }} saved</p>
          </div>
          <div class="poster-rail">
            <TitleCard
              v-for="item in dashboard?.watchlist"
              :key="item.title.id"
              :title="item.title"
              :meta="item.status"
              @open="openTitle(item.title)"
              @watch="markWatched(item.title)"
              @add="addToLibrary(item.title, 'watching')"
            />
            <EmptyRail v-if="!dashboard?.watchlist.length" label="Search the catalog and save titles for later." />
          </div>
        </section>
      </section>

      <section v-else-if="activeView === 'search'" class="view-stack">
        <div class="surface panel-search">
          <div class="search-controls">
            <label>
              <span>Catalog search</span>
              <input v-model="searchQuery" type="search" placeholder="Dune, The Bear, Shogun...">
            </label>
            <label>
              <span>Type</span>
              <select v-model="searchType">
                <option value="all">
                  All
                </option>
                <option value="series">
                  Series
                </option>
                <option value="movie">
                  Movies
                </option>
              </select>
            </label>
            <button class="btn btn-primary" type="button" :disabled="isSearching" @click="runSearch">
              <Search :size="18" />
              {{ isSearching ? 'Searching' : 'Search TMDB' }}
            </button>
          </div>
          <p v-if="searchMessage" class="status-line">
            {{ searchMessage }}
          </p>
        </div>

        <div class="poster-grid">
          <TitleCard
            v-for="title in searchResults"
            :key="title.id"
            :title="title"
            meta="TMDB catalog"
            @open="openTitle(title)"
            @watch="addToLibrary(title, 'watching')"
            @add="addToLibrary(title, 'watchlist')"
          />
          <EmptyRail v-if="!searchResults.length" label="Search results will appear here." />
        </div>
      </section>

      <section v-else-if="activeView === 'library'" class="view-stack">
        <div class="surface library-toolbar">
          <div class="segmented">
            <button
              v-for="filter in libraryFilters"
              :key="filter.id"
              class="segment"
              :class="{ 'is-active': libraryFilter === filter.id }"
              type="button"
              @click="setLibraryFilter(filter.id)"
            >
              {{ filter.label }}
            </button>
          </div>
          <button class="btn btn-ghost" type="button" :disabled="!me" @click="loadLibrary">
            <RefreshCw :size="17" />
            Refresh
          </button>
        </div>

        <div class="poster-grid">
          <TitleCard
            v-for="item in libraryItems"
            :key="item.title.id"
            :title="item.title"
            :meta="item.status"
            @open="openTitle(item.title)"
            @watch="markWatched(item.title)"
            @add="addToLibrary(item.title, item.status === 'watchlist' ? 'watching' : 'watchlist')"
          />
          <EmptyRail v-if="!libraryItems.length" :label="me ? 'No titles in this view yet.' : 'Sign in to see your private library.'" />
        </div>
      </section>

      <section v-else-if="activeView === 'books'" class="view-stack">
        <div class="surface books-command">
          <div>
            <p class="eyebrow">
              Reading tracker
            </p>
            <h2>Books live beside your watch history, not inside it.</h2>
            <p>
              Search Open Library first, fall back to Google Books when needed, and keep reading progress in your private SagaLog account.
            </p>
          </div>
          <p v-if="bookMessage" class="status-line">
            {{ bookMessage }}
          </p>
        </div>

        <div class="stat-strip">
          <div v-for="stat in bookStats" :key="stat.label" class="metric-card">
            <strong>{{ stat.value }}</strong>
            <span>{{ stat.label }}</span>
          </div>
        </div>

        <div class="surface library-toolbar">
          <div class="segmented">
            <button
              v-for="filter in bookFilters"
              :key="filter.id"
              class="segment"
              :class="{ 'is-active': bookLibraryFilter === filter.id }"
              type="button"
              @click="setBookLibraryFilter(filter.id)"
            >
              {{ filter.label }}
            </button>
          </div>
          <button class="btn btn-ghost" type="button" :disabled="!me" @click="loadBookLibrary">
            <RefreshCw :size="17" />
            Refresh
          </button>
        </div>

        <section v-if="bookSearchResults.length" class="rail-section">
          <div class="section-heading">
            <h2>Book results</h2>
            <p>{{ bookSearchResults.length }} matches</p>
          </div>
          <div class="book-grid">
            <BookCard
              v-for="work in bookSearchResults"
              :key="work.id"
              :work="work"
              meta="Open Library"
              @open="openBook(work)"
              @start="addBookToLibrary(work, 'reading')"
              @want="addBookToLibrary(work, 'want_to_read')"
            />
          </div>
        </section>

        <section class="rail-section">
          <div class="section-heading">
            <h2>{{ bookLibraryFilter === 'all' ? 'Reading shelves' : bookStatusLabel(bookLibraryFilter) }}</h2>
            <p>{{ bookLibraryItems.length }} books</p>
          </div>
          <div class="book-grid">
            <BookCard
              v-for="item in bookLibraryItems"
              :key="item.work.id"
              :work="item.work"
              :meta="bookStatusLabel(item.status)"
              :progress="bookProgressLabel(item)"
              @open="openBook(item.work, item)"
              @start="addBookToLibrary(item.work, 'reading')"
              @want="addBookToLibrary(item.work, 'want_to_read')"
            />
            <EmptyRail v-if="!bookLibraryItems.length" :label="me ? 'No books in this shelf yet.' : 'Sign in to build your reading tracker.'" />
          </div>
        </section>
      </section>

      <section v-else-if="activeView === 'import'" class="view-stack">
        <div class="import-grid">
          <section class="surface import-drop">
            <div class="drop-icon">
              <Archive :size="28" />
            </div>
            <div>
              <p class="eyebrow">
                Import into SagaLog
              </p>
              <h2>{{ importedLibrary ? 'TV Time export loaded' : 'TV Time GDPR ZIP' }}</h2>
              <p>
                ZIP parsing still happens in your browser. After review, only normalized watch-history records are sent to your private SagaLog account.
              </p>
              <div class="button-row">
                <button class="btn btn-primary" type="button" @click="fileInput?.click()">
                  <UploadCloud :size="18" />
                  Choose ZIP
                </button>
                <button class="btn btn-ghost" type="button" :disabled="!canSaveImport" @click="saveImportToSagaLog">
                  <Database :size="18" />
                  {{ isSavingImport ? 'Saving' : 'Save to library' }}
                </button>
              </div>
              <input ref="fileInput" class="hidden-input" type="file" accept=".zip,application/zip" @change="handleFileInput">
              <p v-if="importMessage" class="status-line">
                {{ importMessage }}
              </p>
            </div>
          </section>

          <aside class="surface provider-panel">
            <p class="eyebrow">
              Provider transfer
            </p>
            <h2>BetaSeries bridge</h2>
            <p>{{ providerStatus }}</p>
            <div class="provider-row">
              <span v-for="providerLogo in providerLogos" :key="providerLogo.id" class="provider-chip">
                <img :src="providerLogo.logo" :alt="providerLogo.name" @error="hideImage">
                {{ providerLogo.name }}
              </span>
            </div>
            <div class="button-row">
              <button class="btn btn-ghost" type="button" :disabled="!provider?.configured || isAuthPopupOpen" @click="connectProvider">
                <KeyRound :size="18" />
                {{ accessToken ? 'Reconnect' : 'Connect' }}
              </button>
              <button class="btn btn-ghost" type="button" :disabled="!accessToken" @click="disconnectProvider">
                <Unlink :size="18" />
                Disconnect
              </button>
            </div>
          </aside>
        </div>

        <div class="stat-strip">
          <div class="metric-card">
            <strong>{{ importSummary.watchedEpisodes }}</strong>
            <span>episodes</span>
          </div>
          <div class="metric-card">
            <strong>{{ importSummary.shows }}</strong>
            <span>shows</span>
          </div>
          <div class="metric-card">
            <strong>{{ importSummary.watchedMovies }}</strong>
            <span>watched movies</span>
          </div>
          <div class="metric-card">
            <strong>{{ matchedOperationCount }}</strong>
            <span>BetaSeries matches</span>
          </div>
        </div>

        <div class="surface transfer-panel">
          <div class="section-heading">
            <div>
              <h2>Transfer review</h2>
              <p>Use this when you want to send matched history to BetaSeries instead of only importing into SagaLog.</p>
            </div>
            <div class="button-row">
              <button class="btn btn-ghost" type="button" :disabled="!importedLibrary || isMatching" @click="matchLibrary">
                <Search :size="18" />
                {{ isMatching ? 'Matching' : 'Match' }}
              </button>
              <button class="btn btn-primary" type="button" :disabled="!canImportToProvider" @click="importMatchedOperations">
                <Play :size="18" />
                {{ isImportingProvider ? 'Importing' : 'Import matched' }}
              </button>
            </div>
          </div>
          <div class="preview-list">
            <div v-for="row in previewRows" :key="row.id" class="preview-row">
              <strong>{{ row.title }}</strong>
              <span>{{ row.source }}</span>
              <span class="status-pill" :class="row.badgeClass">{{ row.status }}</span>
            </div>
            <EmptyRail v-if="!previewRows.length" label="Load a TV Time export to preview import rows." />
          </div>
        </div>
      </section>

      <section v-else class="view-stack">
        <div class="surface profile-panel">
          <UserRound :size="38" />
          <h2>{{ me ? 'Your private tracker account' : 'Sign in to start tracking' }}</h2>
          <p>
            SagaLog keeps your library private by default. Provider tokens stay in browser memory for transfer flows, and imported history is stored only after you sign in.
          </p>
          <ul class="safety-list">
            <li>
              <ShieldCheck :size="18" />
              Browser-only ZIP parsing before import.
            </li>
            <li>
              <Database :size="18" />
              D1 stores your library and account state.
            </li>
            <li>
              <LockKeyhole :size="18" />
              API responses are not cached by the PWA.
            </li>
          </ul>
        </div>
      </section>
    </main>

    <div v-if="selectedTitle" class="detail-overlay" role="dialog" aria-modal="true" @click.self="selectedTitle = null">
      <article class="detail-sheet">
        <button class="detail-close" type="button" aria-label="Close title details" @click="selectedTitle = null">
          <X :size="20" :stroke-width="3" />
        </button>
        <div class="detail-poster">
          <img v-if="selectedTitle.primaryImageUrl" :src="selectedTitle.primaryImageUrl" alt="">
          <Film v-else :size="44" />
        </div>
        <div class="detail-copy">
          <p class="eyebrow">
            {{ selectedTitle.type }} {{ selectedTitle.startYear ? `· ${selectedTitle.startYear}` : '' }}
          </p>
          <h2>{{ selectedTitle.primaryTitle }}</h2>
          <p>{{ selectedTitle.plot || 'No plot is available yet.' }}</p>
          <div class="detail-meta">
            <span v-if="selectedTitle.nextRelease?.date">
              <CalendarDays :size="16" />
              {{ formatNextRelease(selectedTitle) }}
            </span>
            <span v-if="selectedTitle.ratingAverage">
              <Star :size="16" />
              {{ selectedTitle.ratingAverage }}/10
            </span>
            <span v-if="selectedTitle.runtimeSeconds">
              <Clock3 :size="16" />
              {{ Math.round(selectedTitle.runtimeSeconds / 60) }} min
            </span>
            <span v-if="selectedTitle.genres.length">
              {{ selectedTitle.genres.slice(0, 3).join(' / ') }}
            </span>
          </div>
          <div class="button-row">
            <button class="btn btn-primary" type="button" @click="addToLibrary(selectedTitle, 'watching')">
              <CheckCircle2 :size="18" />
              Track now
            </button>
            <button class="btn btn-ghost" type="button" @click="addToLibrary(selectedTitle, 'watchlist')">
              <Plus :size="18" />
              Watchlist
            </button>
          </div>
        </div>
      </article>
    </div>

    <div v-if="selectedBook" class="detail-overlay" role="dialog" aria-modal="true" @click.self="selectedBook = null">
      <article class="detail-sheet detail-sheet-book">
        <button class="detail-close" type="button" aria-label="Close book details" @click="selectedBook = null">
          <X :size="20" :stroke-width="3" />
        </button>
        <aside class="book-detail-art">
          <div class="book-detail-cover-card">
            <img v-if="selectedBook.coverUrl" :src="selectedBook.coverUrl" alt="">
            <BookOpen v-else :size="44" />
          </div>
          <div class="book-detail-facts">
            <span v-if="selectedBook.firstPublishYear">{{ selectedBook.firstPublishYear }}</span>
            <strong>{{ selectedBook.authors.length ? bookAuthors(selectedBook) : 'Unknown author' }}</strong>
          </div>
        </aside>
        <div class="book-detail-content">
          <header class="book-detail-header">
            <p class="eyebrow">
              {{ selectedBook.firstPublishYear ? `First published ${selectedBook.firstPublishYear}` : 'Book catalog' }}
            </p>
            <h2>{{ selectedBook.title }}</h2>
            <p v-if="selectedBook.subtitle" class="book-subtitle">
              {{ selectedBook.subtitle }}
            </p>
            <div class="detail-meta">
              <span v-if="selectedBook.authors.length">
                <UserRound :size="16" />
                {{ bookAuthors(selectedBook) }}
              </span>
              <span v-if="selectedBook.subjects.length">
                {{ selectedBook.subjects.slice(0, 3).join(' / ') }}
              </span>
            </div>
          </header>
          <div class="book-detail-grid">
            <section class="book-synopsis">
              <p>{{ selectedBook.description || 'No book description is available yet.' }}</p>
            </section>
            <aside v-if="me" class="reading-panel">
              <p class="eyebrow">
                Reading log
              </p>
              <h3>Track this book</h3>
              <div class="book-action-grid">
                <button class="btn btn-primary" type="button" @click="addBookToLibrary(selectedBook, 'reading')">
                  <BookOpen :size="18" />
                  Reading
                </button>
                <button class="btn btn-ghost" type="button" @click="addBookToLibrary(selectedBook, 'want_to_read')">
                  <Plus :size="18" />
                  Want to read
                </button>
                <button class="btn btn-ghost" type="button" @click="addBookToLibrary(selectedBook, 'read')">
                  <CheckCircle2 :size="18" />
                  Read
                </button>
              </div>
              <div class="book-progress-form">
                <label>
                  <span>Current page</span>
                  <input v-model.number="bookProgressPage" type="number" min="0" inputmode="numeric" placeholder="0">
                </label>
                <label>
                  <span>Total pages</span>
                  <input v-model.number="bookProgressTotal" type="number" min="1" inputmode="numeric" placeholder="Optional">
                </label>
                <button class="btn btn-primary" type="button" @click="saveBookProgress">
                  <BookOpen :size="18" />
                  Save progress
                </button>
              </div>
            </aside>
            <aside v-else class="reading-panel reading-panel-locked">
              <LockKeyhole :size="22" />
              <div>
                <p class="eyebrow">
                  Private reading log
                </p>
                <h3>Sign in to save progress</h3>
                <p>
                  Create your private SagaLog library to mark this book as reading, want to read, or finished.
                </p>
              </div>
              <button class="btn btn-primary" type="button" @click="promptSigninFromBook">
                <Mail :size="18" />
                Sign in
              </button>
            </aside>
          </div>
          <section class="related-volumes">
            <div class="related-volumes-heading">
              <div>
                <p class="eyebrow">
                  Series / related volumes
                </p>
                <h3>{{ relatedBooks.length ? 'More by this author' : 'Looking for related volumes' }}</h3>
              </div>
              <span v-if="isLoadingRelatedBooks">Loading</span>
              <span v-else>{{ relatedBooks.length }} found</span>
            </div>
            <div v-if="relatedBooks.length" class="volume-strip">
              <button
                v-for="volume in relatedBooks"
                :key="volume.id"
                class="volume-card"
                type="button"
                @click="openBook(volume)"
              >
                <span class="volume-cover">
                  <img v-if="volume.coverUrl" :src="volume.coverUrl" alt="">
                  <BookOpen v-else :size="20" />
                </span>
                <span>
                  <strong>{{ volume.title }}</strong>
                  <small>{{ volume.firstPublishYear || 'Year unknown' }}</small>
                </span>
              </button>
            </div>
            <p v-else-if="!isLoadingRelatedBooks" class="volume-empty">
              No related volumes found for this book yet.
            </p>
          </section>
        </div>
      </article>
    </div>

    <nav class="mobile-tabs" aria-label="Mobile primary">
      <button
        v-for="item in navigation"
        :key="`mobile-${item.id}`"
        :class="{ 'is-active': activeView === item.id }"
        :aria-label="item.label"
        type="button"
        @click="activeView = item.id"
      >
        <component :is="item.icon" :size="19" />
      </button>
    </nav>
  </div>
</template>

<script setup lang="ts">
import {
  Archive,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Database,
  Film,
  Home,
  KeyRound,
  Library,
  LockKeyhole,
  LogOut,
  Mail,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  Tv,
  Unlink,
  UploadCloud,
  UserRound,
  X
} from '@lucide/vue'
import { h, type Component } from 'vue'
import type { BookDashboard, BookLibraryItem, BookLibraryStatus, BookWork } from '~~/core/domain/books'
import { stableMediaId, type NormalizedLibrary } from '~~/core/domain/media'
import type { CatalogTitle, LibraryItem, LibraryStatus, TrackerDashboard, UserAccount } from '~~/core/domain/tracker'
import type { ImportResultLine, ProviderDescriptor, ProviderMovieMatch, ProviderShowMatch } from '~~/core/domain/migration'
import type { ProviderImportOperation, ProviderMovieMatchRequest, ProviderShowMatchRequest } from '~~/core/ports/media-provider'
import { buildTransferPlan, summarizeLibrary } from '~~/core/application/build-transfer-plan'

type ViewId = 'home' | 'search' | 'library' | 'books' | 'import' | 'profile'
type SearchType = 'all' | 'movie' | 'series'

interface ProvidersResponse {
  providers: ProviderDescriptor[]
}

interface AuthMessage {
  type?: string
  provider?: string
  accessToken?: string
  error?: string
}

interface PreviewRow {
  id: string
  title: string
  source: string
  status: string
  badgeClass: string
}

interface ProviderLogo {
  id: string
  name: string
  logo: string
}

interface BooksResponse {
  dashboard: BookDashboard
  items: BookLibraryItem[]
}

const TitleCard = defineComponent({
  props: {
    title: {
      type: Object as PropType<CatalogTitle>,
      required: true
    },
    meta: {
      type: String,
      default: ''
    }
  },
  emits: ['watch', 'add', 'open'],
  setup(props, { emit }) {
    return () => h('article', { class: 'title-card', onClick: () => emit('open') }, [
      props.title.primaryImageUrl
        ? h('img', { src: props.title.primaryImageUrl, alt: '', class: 'poster-image' })
        : h('div', { class: 'poster-fallback' }, [
            h(Film, { size: 28 }),
            h('span', props.title.type)
          ]),
      h('div', { class: 'title-card-body' }, [
        h('span', { class: 'title-meta' }, [
          props.title.type === 'series' ? h(Tv, { size: 14 }) : h(Film, { size: 14 }),
          props.title.startYear ? String(props.title.startYear) : props.meta
        ]),
        h('h3', props.title.primaryTitle),
        props.title.nextRelease?.date
          ? h('span', { class: 'release-chip' }, [
              h(CalendarDays, { size: 13 }),
              formatNextRelease(props.title)
            ])
          : null,
        h('p', props.title.genres?.slice(0, 2).join(' / ') || props.title.plot || 'No description yet.'),
        h('div', { class: 'card-actions' }, [
          h('button', { class: 'icon-action', type: 'button', title: 'Watch', onClick: (event: Event) => { event.stopPropagation(); emit('watch') } }, [h(CheckCircle2, { size: 17 })]),
          h('button', { class: 'icon-action', type: 'button', title: 'Add', onClick: (event: Event) => { event.stopPropagation(); emit('add') } }, [h(Plus, { size: 17 })])
        ])
      ])
    ])
  }
})

const BookCard = defineComponent({
  props: {
    work: {
      type: Object as PropType<BookWork>,
      required: true
    },
    meta: {
      type: String,
      default: ''
    },
    progress: {
      type: String,
      default: ''
    }
  },
  emits: ['open', 'start', 'want'],
  setup(props, { emit }) {
    return () => h('article', { class: 'book-card', onClick: () => emit('open') }, [
      h('div', { class: 'book-cover' }, [
        props.work.coverUrl
          ? h('img', { src: props.work.coverUrl, alt: '' })
          : h(BookOpen, { size: 30 })
      ]),
      h('div', { class: 'book-card-body' }, [
        h('span', { class: 'title-meta' }, [
          h(BookOpen, { size: 14 }),
          props.meta || (props.work.firstPublishYear ? String(props.work.firstPublishYear) : 'Book')
        ]),
        h('h3', props.work.title),
        props.work.authors.length
          ? h('p', { class: 'book-author-line' }, bookAuthors(props.work))
          : null,
        props.progress
          ? h('span', { class: 'reading-progress-chip' }, props.progress)
          : null,
        h('p', props.work.subjects.slice(0, 2).join(' / ') || props.work.description || 'No description yet.'),
        h('div', { class: 'card-actions' }, [
          h('button', { class: 'icon-action', type: 'button', title: 'Reading', onClick: (event: Event) => { event.stopPropagation(); emit('start') } }, [h(BookOpen, { size: 17 })]),
          h('button', { class: 'icon-action', type: 'button', title: 'Want to read', onClick: (event: Event) => { event.stopPropagation(); emit('want') } }, [h(Plus, { size: 17 })])
        ])
      ])
    ])
  }
})

const EmptyRail = defineComponent({
  props: {
    label: {
      type: String,
      required: true
    }
  },
  setup(props) {
    return () => h('div', { class: 'empty-card' }, props.label)
  }
})

const MATCH_SHOW_BATCH_SIZE = 8
const MATCH_MOVIE_BATCH_SIZE = 20
const IMPORT_BATCH_SIZE = 25

const navigation: Array<{ id: ViewId, label: string, icon: Component }> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'books', label: 'Books', icon: BookOpen },
  { id: 'import', label: 'Import', icon: UploadCloud },
  { id: 'profile', label: 'Profile', icon: UserRound }
]

const libraryFilters: Array<{ id: LibraryStatus | 'all', label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'watching', label: 'Watching' },
  { id: 'watchlist', label: 'Watchlist' },
  { id: 'completed', label: 'Completed' },
  { id: 'paused', label: 'Paused' },
  { id: 'dropped', label: 'Dropped' }
]

const bookFilters: Array<{ id: BookLibraryStatus | 'all', label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'reading', label: 'Reading' },
  { id: 'want_to_read', label: 'Want to read' },
  { id: 'read', label: 'Read' },
  { id: 'paused', label: 'Paused' },
  { id: 'dnf', label: 'DNF' }
]

const providerLogos: ProviderLogo[] = [
  { id: 'betaseries', name: 'BetaSeries', logo: '/providers/betaseries.png' },
  { id: 'trakt', name: 'Trakt', logo: '/providers/trakt.png' },
  { id: 'serializd', name: 'Serializd', logo: '/providers/serializd.png' }
]

const heroCards = [
  { title: 'Continue Watching', type: 'Series', color: '#e50914' },
  { title: 'Reading Stack', type: 'Books', color: '#f5c542' },
  { title: 'Imported History', type: 'Archive', color: '#7dd3fc' },
  { title: 'Movie Night', type: 'Movies', color: '#a78bfa' }
]

const fallbackCapabilities = {
  watchedEpisodes: true,
  watchedMovies: true,
  showLibrary: true,
  movieWatchlist: true,
  ratings: false,
  watchedAt: false,
  rewatches: false
}

const activeView = ref<ViewId>('home')
const email = ref('')
const me = ref<UserAccount | null>(null)
const devMagicLink = ref('')
const isRequestingLink = ref(false)

const dashboard = ref<TrackerDashboard | null>(null)
const libraryItems = ref<LibraryItem[]>([])
const libraryFilter = ref<LibraryStatus | 'all'>('all')

const bookDashboard = ref<BookDashboard | null>(null)
const bookLibraryItems = ref<BookLibraryItem[]>([])
const bookLibraryFilter = ref<BookLibraryStatus | 'all'>('all')
const bookSearchQuery = ref('')
const bookSearchResults = ref<BookWork[]>([])
const isSearchingBooks = ref(false)
const bookMessage = ref('')
const selectedBook = ref<BookWork | null>(null)
const selectedBookItem = ref<BookLibraryItem | null>(null)
const bookProgressPage = ref<number | undefined>()
const bookProgressTotal = ref<number | undefined>()
const relatedBooks = ref<BookWork[]>([])
const isLoadingRelatedBooks = ref(false)

const searchQuery = ref('')
const searchType = ref<SearchType>('all')
const searchResults = ref<CatalogTitle[]>([])
const isSearching = ref(false)
const searchMessage = ref('')
const selectedTitle = ref<CatalogTitle | null>(null)

const fileInput = ref<HTMLInputElement | null>(null)
const importedLibrary = shallowRef<NormalizedLibrary | null>(null)
const importMessage = ref('')
const isParsing = ref(false)
const isSavingImport = ref(false)

const providers = ref<ProviderDescriptor[]>([])
const accessToken = ref('')
const showMatches = ref<ProviderShowMatch[]>([])
const movieMatches = ref<ProviderMovieMatch[]>([])
const importResults = ref<ImportResultLine[]>([])
const isMatching = ref(false)
const isImportingProvider = ref(false)
const isAuthPopupOpen = ref(false)
let authPopupPollTimer: ReturnType<typeof setInterval> | undefined

const currentViewLabel = computed(() => navigation.find((item) => item.id === activeView.value)?.label ?? 'SagaLog')
const currentHeadline = computed(() => {
  if (activeView.value === 'home') return 'Your tracking home'
  if (activeView.value === 'search') return 'Find shows and movies'
  if (activeView.value === 'library') return 'Private library'
  if (activeView.value === 'books') return 'Reading library'
  if (activeView.value === 'import') return 'Import and transfer'
  return 'Account and privacy'
})
const initials = computed(() => (me.value?.displayName || me.value?.email || 'WB').slice(0, 2).toUpperCase())
const importSummary = computed(() => importedLibrary.value
  ? summarizeLibrary(importedLibrary.value)
  : { watchedEpisodes: 0, shows: 0, watchedMovies: 0, movieList: 0, warnings: 0 })
const dashboardStats = computed(() => [
  { label: 'watching', value: dashboard.value?.summary.watching ?? 0 },
  { label: 'watchlist', value: dashboard.value?.summary.watchlist ?? 0 },
  { label: 'completed', value: dashboard.value?.summary.completed ?? 0 },
  { label: 'favorites', value: dashboard.value?.summary.favorites ?? 0 }
])
const bookStats = computed(() => [
  { label: 'reading', value: bookDashboard.value?.summary.reading ?? 0 },
  { label: 'want to read', value: bookDashboard.value?.summary.wantToRead ?? 0 },
  { label: 'read', value: bookDashboard.value?.summary.read ?? 0 },
  { label: 'favorites', value: bookDashboard.value?.summary.favorites ?? 0 }
])
const provider = computed(() => providers.value.find((item) => item.id === 'betaseries'))
const providerStatus = computed(() => {
  if (!provider.value) return 'Provider configuration loading.'
  if (!provider.value.configured) return `Missing ${provider.value.configuration?.missing.join(', ') || 'BetaSeries settings'}.`
  if (accessToken.value) return 'BetaSeries connected for this browser session.'
  return 'BetaSeries ready for OAuth transfer.'
})
const providerCapabilities = computed(() => provider.value?.capabilities ?? fallbackCapabilities)
const transferPlan = computed(() => importedLibrary.value ? buildTransferPlan(importedLibrary.value, providerCapabilities.value) : null)
const matchedOperationCount = computed(() => buildProviderOperations().length)
const canSaveImport = computed(() => Boolean(me.value && importedLibrary.value && !isSavingImport.value))
const canImportToProvider = computed(() => Boolean(accessToken.value && matchedOperationCount.value > 0 && !isImportingProvider.value))

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

const previewRows = computed<PreviewRow[]>(() => {
  if (!importedLibrary.value) {
    return []
  }

  const episodes = importedLibrary.value.watchedEpisodes.slice(0, 8).map((episode) => ({
    id: episode.id,
    title: `${episode.showTitle} S${episode.seasonNumber}E${episode.episodeNumber}`,
    source: episode.watchedAt?.slice(0, 10) ?? 'TV Time',
    status: matchedEpisodeIds.value.has(episode.id) ? 'matched' : 'ready',
    badgeClass: matchedEpisodeIds.value.has(episode.id) ? 'is-success' : 'is-ready'
  }))
  const movies = importedLibrary.value.watchedMovies.slice(0, 4).map((movie) => ({
    id: movie.id,
    title: movie.title,
    source: movie.watchedAt?.slice(0, 10) ?? 'TV Time',
    status: matchedMovieIds.value.has(movie.id) ? 'matched' : 'ready',
    badgeClass: matchedMovieIds.value.has(movie.id) ? 'is-success' : 'is-ready'
  }))
  return [...episodes, ...movies]
})

function formatNextRelease(title: CatalogTitle): string {
  const next = title.nextRelease
  if (!next?.date) {
    return ''
  }

  const date = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${next.date}T00:00:00Z`))
  if (next.kind === 'movie') {
    return `Releases ${date}`
  }

  const episodeCode = next.seasonNumber && next.episodeNumber
    ? `S${next.seasonNumber}E${next.episodeNumber}`
    : 'Next episode'
  return `${episodeCode} ${date}`
}

onMounted(async () => {
  window.addEventListener('message', handleAuthMessage)
  await Promise.all([loadMe(), loadProviders()])
  if (new URLSearchParams(window.location.search).get('signedIn') === '1') {
    window.history.replaceState({}, '', '/')
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('message', handleAuthMessage)
  clearAuthPopupWatch()
})

async function loadMe(): Promise<void> {
  const response = await $fetch<{ user?: UserAccount }>('/api/me').catch(() => ({ user: undefined }))
  me.value = response.user ?? null
  if (me.value) {
    await Promise.all([loadLibrary(), loadBookLibrary()])
  }
}

async function loadLibrary(): Promise<void> {
  if (!me.value) {
    dashboard.value = null
    libraryItems.value = []
    return
  }
  const response = await $fetch<{ dashboard: TrackerDashboard, items: LibraryItem[] }>('/api/library', {
    query: libraryFilter.value === 'all' ? undefined : { status: libraryFilter.value }
  })
  dashboard.value = response.dashboard
  libraryItems.value = response.items
}

async function loadBookLibrary(): Promise<void> {
  if (!me.value) {
    bookDashboard.value = null
    bookLibraryItems.value = []
    return
  }

  const response = await $fetch<BooksResponse>('/api/books/library', {
    query: bookLibraryFilter.value === 'all' ? undefined : { status: bookLibraryFilter.value }
  })
  bookDashboard.value = response.dashboard
  bookLibraryItems.value = response.items
}

async function loadProviders(): Promise<void> {
  const response = await $fetch<ProvidersResponse>('/api/providers').catch(() => ({ providers: [] }))
  providers.value = response.providers
}

async function requestSignin(): Promise<void> {
  isRequestingLink.value = true
  devMagicLink.value = ''
  try {
    const response = await $fetch<{ devMagicLink?: string }>('/api/auth/magic-link/request', {
      method: 'POST',
      body: { email: email.value }
    })
    devMagicLink.value = response.devMagicLink ?? ''
  } finally {
    isRequestingLink.value = false
  }
}

async function logoutUser(): Promise<void> {
  await $fetch('/api/auth/logout', { method: 'POST' })
  me.value = null
  dashboard.value = null
  libraryItems.value = []
  bookDashboard.value = null
  bookLibraryItems.value = []
}

async function runSearch(): Promise<void> {
  if (searchQuery.value.trim().length < 2) {
    searchMessage.value = 'Type at least two characters.'
    return
  }
  activeView.value = 'search'
  isSearching.value = true
  searchMessage.value = ''
  try {
    const response = await $fetch<{ results: CatalogTitle[] }>('/api/catalog/search', {
      query: { q: searchQuery.value, type: searchType.value, limit: 18 }
    })
    searchResults.value = response.results
    searchMessage.value = response.results.length ? '' : 'No catalog results found yet.'
  } catch (error) {
    searchMessage.value = error instanceof Error ? error.message : 'Search failed.'
  } finally {
    isSearching.value = false
  }
}

async function runBookSearch(): Promise<void> {
  if (bookSearchQuery.value.trim().length < 2) {
    bookMessage.value = 'Type at least two characters.'
    return
  }

  activeView.value = 'books'
  isSearchingBooks.value = true
  bookMessage.value = ''
  try {
    const response = await $fetch<{ results: BookWork[] }>('/api/books/search', {
      query: { q: bookSearchQuery.value, limit: 18 }
    })
    bookSearchResults.value = response.results
    bookMessage.value = response.results.length ? '' : 'No book results found yet.'
  } catch (error) {
    bookMessage.value = error instanceof Error ? error.message : 'Book search failed.'
  } finally {
    isSearchingBooks.value = false
  }
}

async function addToLibrary(title: CatalogTitle, status: LibraryStatus): Promise<void> {
  if (!me.value) {
    activeView.value = 'profile'
    return
  }
  await $fetch(`/api/library/items/${encodeURIComponent(title.id)}`, {
    method: 'PUT',
    body: { title, status }
  })
  await loadLibrary()
}

async function addBookToLibrary(work: BookWork, status: BookLibraryStatus): Promise<void> {
  if (!me.value) {
    activeView.value = 'profile'
    return
  }

  const existingItem = selectedBook.value?.id === work.id
    ? selectedBookItem.value
    : bookLibraryItems.value.find((item) => item.work.id === work.id) ?? null
  const totalPages = selectedBook.value?.id === work.id ? bookProgressTotal.value || existingItem?.totalPages : existingItem?.totalPages
  const currentPage = status === 'read'
    ? totalPages
    : selectedBook.value?.id === work.id ? bookProgressPage.value || existingItem?.currentPage : existingItem?.currentPage
  await $fetch(`/api/books/library/${encodeURIComponent(work.id)}`, {
    method: 'PUT',
    body: {
      work,
      status,
      currentPage,
      totalPages,
      currentPercent: totalPages && currentPage !== undefined ? Math.min(100, Math.round((currentPage / totalPages) * 100)) : undefined
    }
  })
  await loadBookLibrary()
}

async function openTitle(title: CatalogTitle): Promise<void> {
  selectedTitle.value = title
  const response = await $fetch<{ title: CatalogTitle }>(`/api/catalog/titles/${encodeURIComponent(title.id)}`).catch(() => undefined)
  if (response?.title) {
    selectedTitle.value = response.title
  }
}

async function openBook(work: BookWork, item?: BookLibraryItem): Promise<void> {
  selectedBook.value = work
  selectedBookItem.value = item ?? bookLibraryItems.value.find((candidate) => candidate.work.id === work.id) ?? null
  bookProgressPage.value = selectedBookItem.value?.currentPage
  bookProgressTotal.value = selectedBookItem.value?.totalPages
  relatedBooks.value = []
  const response = await $fetch<{ book: BookWork }>(`/api/books/${encodeURIComponent(work.id)}`).catch(() => undefined)
  if (response?.book) {
    selectedBook.value = mergeBookDetail(work, response.book)
  }
  await loadRelatedBooks(selectedBook.value)
}

function mergeBookDetail(seed: BookWork, detail: BookWork): BookWork {
  return {
    ...detail,
    subtitle: detail.subtitle ?? seed.subtitle,
    coverUrl: detail.coverUrl ?? seed.coverUrl,
    firstPublishYear: detail.firstPublishYear ?? seed.firstPublishYear,
    subjects: detail.subjects.length > 0 ? detail.subjects : seed.subjects,
    sourcePayload: detail.sourcePayload ?? seed.sourcePayload
  }
}

async function markWatched(title: CatalogTitle): Promise<void> {
  if (!me.value) {
    activeView.value = 'profile'
    return
  }
  await addToLibrary(title, 'completed')
  await $fetch('/api/library/watch-events', {
    method: 'POST',
    body: {
      titleId: title.id,
      watchedAt: new Date().toISOString(),
      source: 'manual'
    }
  })
}

function setLibraryFilter(filter: LibraryStatus | 'all'): void {
  libraryFilter.value = filter
  void loadLibrary()
}

function setBookLibraryFilter(filter: BookLibraryStatus | 'all'): void {
  bookLibraryFilter.value = filter
  void loadBookLibrary()
}

async function loadRelatedBooks(work: BookWork | null): Promise<void> {
  if (!work) {
    return
  }

  isLoadingRelatedBooks.value = true
  try {
    const response = await $fetch<{ volumes: BookWork[] }>(`/api/books/${encodeURIComponent(work.id)}/volumes`, {
      query: { limit: 12 }
    })
    relatedBooks.value = response.volumes
  } catch {
    relatedBooks.value = []
  } finally {
    isLoadingRelatedBooks.value = false
  }
}

async function saveBookProgress(): Promise<void> {
  if (!selectedBook.value) {
    return
  }
  if (!me.value) {
    activeView.value = 'profile'
    return
  }

  const currentPage = typeof bookProgressPage.value === 'number' ? bookProgressPage.value : undefined
  const totalPages = typeof bookProgressTotal.value === 'number' ? bookProgressTotal.value : undefined
  await $fetch('/api/books/progress', {
    method: 'POST',
    body: {
      work: selectedBook.value,
      currentPage,
      totalPages,
      currentPercent: totalPages && currentPage !== undefined ? Math.min(100, Math.round((currentPage / totalPages) * 100)) : undefined,
      recordedAt: new Date().toISOString()
    }
  })
  await loadBookLibrary()
}

function promptSigninFromBook(): void {
  selectedBook.value = null
  activeView.value = 'profile'
}

function bookAuthors(work: BookWork): string {
  return work.authors.map((author) => author.name).slice(0, 3).join(', ')
}

function bookStatusLabel(status: BookLibraryStatus | 'all'): string {
  const labels: Record<BookLibraryStatus | 'all', string> = {
    all: 'All books',
    want_to_read: 'Want to read',
    reading: 'Reading',
    read: 'Read',
    paused: 'Paused',
    dnf: 'Did not finish'
  }
  return labels[status]
}

function bookProgressLabel(item: BookLibraryItem): string {
  if (item.currentPage !== undefined && item.totalPages) {
    return `${item.currentPage}/${item.totalPages} pages`
  }
  if (item.currentPercent !== undefined) {
    return `${Math.round(item.currentPercent)}%`
  }
  return ''
}

function handleFileInput(event: Event): void {
  const input = event.target as HTMLInputElement
  void parseFile(input.files?.[0])
  input.value = ''
}

async function parseFile(file: File | undefined): Promise<void> {
  if (!file) return
  isParsing.value = true
  importMessage.value = ''
  showMatches.value = []
  movieMatches.value = []
  importResults.value = []
  try {
    const { readTvTimeGdprZip } = await import('~~/infra/sources/tvtime-gdpr-reader')
    importedLibrary.value = await readTvTimeGdprZip(file)
    importMessage.value = `Loaded ${file.name}. Review counts before saving.`
  } catch (error) {
    importedLibrary.value = null
    importMessage.value = error instanceof Error ? error.message : 'Could not parse ZIP.'
  } finally {
    isParsing.value = false
  }
}

async function saveImportToSagaLog(): Promise<void> {
  if (!me.value || !importedLibrary.value) {
    activeView.value = me.value ? 'import' : 'profile'
    return
  }
  isSavingImport.value = true
  importMessage.value = ''
  try {
    const totalItems = importSummary.value.watchedEpisodes + importSummary.value.shows + importSummary.value.watchedMovies + importSummary.value.movieList
    const { job } = await $fetch<{ job: { id: string } }>('/api/imports/tvtime/jobs', {
      method: 'POST',
      body: { totalItems }
    })
    const previewItems = [
      ...importedLibrary.value.watchedEpisodes.map((item) => item.id),
      ...importedLibrary.value.shows.map((item) => item.id),
      ...importedLibrary.value.watchedMovies.map((item) => item.id),
      ...importedLibrary.value.movieList.map((item) => item.id)
    ]
    for (const batch of chunk(previewItems, 250)) {
      await $fetch(`/api/imports/${job.id}/chunks`, {
        method: 'POST',
        body: { items: batch }
      })
    }
    const { result } = await $fetch<{ result: { importedItems: number, failedItems: number } }>(`/api/imports/${job.id}/commit`, {
      method: 'POST',
      body: { library: importedLibrary.value }
    })
    importMessage.value = `Imported ${result.importedItems} records into SagaLog.`
    await loadLibrary()
  } catch (error) {
    importMessage.value = error instanceof Error ? error.message : 'Import failed.'
  } finally {
    isSavingImport.value = false
  }
}

function connectProvider(): void {
  clearAuthPopupWatch()
  isAuthPopupOpen.value = true
  const popup = window.open('/api/providers/betaseries/auth', 'betaseries-oauth', 'popup,width=680,height=780,noopener=false')
  if (!popup) {
    isAuthPopupOpen.value = false
    importMessage.value = 'Popup was blocked.'
    return
  }
  watchAuthPopup(popup as Window & { __WATCHBRIDGE_AUTH_RESULT__?: AuthMessage })
}

function disconnectProvider(): void {
  clearAuthPopupWatch()
  accessToken.value = ''
}

function handleAuthMessage(event: MessageEvent): void {
  if (event.origin !== window.location.origin) return
  const data = event.data as AuthMessage
  if (data.type !== 'watchbridge:provider-auth' || data.provider !== 'betaseries') return
  completeProviderAuth(data)
}

function completeProviderAuth(data: AuthMessage): void {
  clearAuthPopupWatch()
  isAuthPopupOpen.value = false
  if (data.error) {
    importMessage.value = data.error
    return
  }
  accessToken.value = data.accessToken ?? ''
}

function watchAuthPopup(popup: Window & { __WATCHBRIDGE_AUTH_RESULT__?: AuthMessage }): void {
  authPopupPollTimer = setInterval(() => {
    if (popup.closed) {
      clearAuthPopupWatch()
      isAuthPopupOpen.value = false
      return
    }
    try {
      const result = popup.__WATCHBRIDGE_AUTH_RESULT__
      if (result?.type === 'watchbridge:provider-auth' && result.provider === 'betaseries') {
        popup.close()
        completeProviderAuth(result)
      }
    } catch {
      // Cross-origin while the popup is still on BetaSeries.
    }
  }, 250)
}

function clearAuthPopupWatch(): void {
  if (authPopupPollTimer) {
    clearInterval(authPopupPollTimer)
    authPopupPollTimer = undefined
  }
}

async function matchLibrary(): Promise<void> {
  if (!importedLibrary.value || isMatching.value) return
  isMatching.value = true
  showMatches.value = []
  movieMatches.value = []

  const showRequests = buildShowMatchRequests(importedLibrary.value)
  const movieRequests = buildMovieMatchRequests(importedLibrary.value)
  const totalBatches = Math.max(
    Math.ceil(showRequests.length / MATCH_SHOW_BATCH_SIZE),
    Math.ceil(movieRequests.length / MATCH_MOVIE_BATCH_SIZE),
    1
  )

  try {
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex += 1) {
      const response = await $fetch<{ shows: ProviderShowMatch[], movies: ProviderMovieMatch[] }>('/api/providers/betaseries/match', {
        method: 'POST',
        body: {
          shows: showRequests.slice(batchIndex * MATCH_SHOW_BATCH_SIZE, (batchIndex + 1) * MATCH_SHOW_BATCH_SIZE),
          movies: movieRequests.slice(batchIndex * MATCH_MOVIE_BATCH_SIZE, (batchIndex + 1) * MATCH_MOVIE_BATCH_SIZE)
        }
      })
      showMatches.value.push(...response.shows)
      movieMatches.value.push(...response.movies)
    }
    importMessage.value = `Matched ${matchedOperationCount.value} provider operations.`
  } catch (error) {
    importMessage.value = error instanceof Error ? error.message : 'Matching failed.'
  } finally {
    isMatching.value = false
  }
}

async function importMatchedOperations(): Promise<void> {
  if (!canImportToProvider.value) return
  isImportingProvider.value = true
  try {
    const operations = buildProviderOperations()
    for (const batch of chunk(operations, IMPORT_BATCH_SIZE)) {
      const response = await $fetch<{ results: ImportResultLine[] }>('/api/providers/betaseries/import', {
        method: 'POST',
        body: { accessToken: accessToken.value, operations: batch }
      })
      importResults.value.push(...response.results)
    }
    importMessage.value = `Sent ${importResults.value.length} matched operations to BetaSeries.`
  } catch (error) {
    importMessage.value = error instanceof Error ? error.message : 'Provider import failed.'
  } finally {
    isImportingProvider.value = false
  }
}

function buildShowMatchRequests(source: NormalizedLibrary): ProviderShowMatchRequest[] {
  const grouped = new Map<string, ProviderShowMatchRequest>()
  for (const show of source.shows) {
    grouped.set(show.id, { sourceShowId: show.id, title: show.title, episodes: [] })
  }
  for (const episode of source.watchedEpisodes) {
    const key = episode.source.showId ? stableMediaId(['tvtime', 'show', episode.source.showId]) : `title-${episode.showTitle.toLowerCase()}`
    const existing = grouped.get(key) ?? { sourceShowId: key, title: episode.showTitle, episodes: [] }
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
    grouped.set(movie.id, { sourceMovieId: movie.id, title: movie.title, releaseDate: movie.releaseDate })
  }
  for (const movie of source.movieList) {
    grouped.set(movie.id, { sourceMovieId: movie.id, title: movie.title, releaseDate: movie.releaseDate })
  }
  return [...grouped.values()]
}

function buildProviderOperations(): ProviderImportOperation[] {
  if (!transferPlan.value) return []
  const operations: ProviderImportOperation[] = []
  for (const operation of transferPlan.value.operations) {
    if (operation.kind === 'episode-watched') {
      const providerId = matchedEpisodeIds.value.get(operation.item.id)
      if (providerId) operations.push({ operationId: operation.id, kind: operation.kind, providerId, state: 'watched' })
    } else if (operation.kind === 'show-library') {
      const providerId = matchedShowIds.value.get(operation.item.id)
      if (providerId) operations.push({ operationId: operation.id, kind: operation.kind, providerId, state: 'followed' })
    } else if (operation.kind === 'movie-watched') {
      const providerId = matchedMovieIds.value.get(operation.item.id)
      if (providerId) operations.push({ operationId: operation.id, kind: operation.kind, providerId, state: 'watched' })
    } else if (operation.kind === 'movie-list') {
      const providerId = matchedMovieIds.value.get(operation.item.id)
      if (providerId) operations.push({ operationId: operation.id, kind: operation.kind, providerId, state: operation.item.state })
    }
  }
  return operations
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size))
  }
  return batches
}

function hideImage(event: Event): void {
  const image = event.currentTarget as HTMLImageElement
  image.hidden = true
}
</script>
