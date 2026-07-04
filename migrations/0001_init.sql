PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS auth_magic_links (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS catalog_titles (
  id TEXT PRIMARY KEY,
  imdb_id TEXT UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('movie', 'series')),
  primary_title TEXT NOT NULL,
  original_title TEXT,
  primary_image_url TEXT,
  start_year INTEGER,
  end_year INTEGER,
  runtime_seconds INTEGER,
  plot TEXT,
  rating_average REAL,
  rating_count INTEGER,
  genres_json TEXT NOT NULL DEFAULT '[]',
  source_payload_json TEXT,
  fetched_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS catalog_episodes (
  id TEXT PRIMARY KEY,
  imdb_id TEXT UNIQUE,
  series_title_id TEXT NOT NULL REFERENCES catalog_titles(id) ON DELETE CASCADE,
  season_number INTEGER NOT NULL,
  episode_number INTEGER NOT NULL,
  primary_title TEXT NOT NULL,
  air_date TEXT,
  runtime_seconds INTEGER,
  plot TEXT,
  fetched_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (series_title_id, season_number, episode_number)
);

CREATE TABLE IF NOT EXISTS user_library_items (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title_id TEXT NOT NULL REFERENCES catalog_titles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('watchlist', 'watching', 'completed', 'paused', 'dropped')),
  favorite INTEGER NOT NULL DEFAULT 0,
  added_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, title_id)
);

CREATE TABLE IF NOT EXISTS user_episode_progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  episode_id TEXT NOT NULL REFERENCES catalog_episodes(id) ON DELETE CASCADE,
  progress_state TEXT NOT NULL CHECK (progress_state IN ('watched', 'unwatched')),
  watched_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, episode_id)
);

CREATE TABLE IF NOT EXISTS watch_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title_id TEXT REFERENCES catalog_titles(id) ON DELETE CASCADE,
  episode_id TEXT REFERENCES catalog_episodes(id) ON DELETE CASCADE,
  watched_at TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('manual', 'import', 'provider')),
  source_event_key TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS user_ratings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title_id TEXT REFERENCES catalog_titles(id) ON DELETE CASCADE,
  episode_id TEXT REFERENCES catalog_episodes(id) ON DELETE CASCADE,
  rating_10 INTEGER NOT NULL CHECK (rating_10 BETWEEN 1 AND 10),
  review_text TEXT,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, title_id, episode_id)
);

CREATE TABLE IF NOT EXISTS user_lists (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('custom', 'watchlist', 'favorites')),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, slug)
);

CREATE TABLE IF NOT EXISTS user_list_items (
  list_id TEXT NOT NULL REFERENCES user_lists(id) ON DELETE CASCADE,
  title_id TEXT NOT NULL REFERENCES catalog_titles(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  added_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (list_id, title_id)
);

CREATE TABLE IF NOT EXISTS import_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('tvtime-gdpr')),
  status TEXT NOT NULL CHECK (status IN ('preview', 'running', 'completed', 'failed')),
  total_items INTEGER NOT NULL DEFAULT 0,
  imported_items INTEGER NOT NULL DEFAULT 0,
  failed_items INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS import_job_items (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  source_key TEXT NOT NULL,
  target_kind TEXT NOT NULL,
  target_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'imported', 'skipped', 'failed')),
  message TEXT,
  UNIQUE (job_id, source_key)
);

CREATE TABLE IF NOT EXISTS provider_connections (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  provider_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_magic_links_hash ON auth_magic_links(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_hash ON auth_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_catalog_titles_imdb ON catalog_titles(imdb_id);
CREATE INDEX IF NOT EXISTS idx_catalog_titles_search ON catalog_titles(type, primary_title, start_year);
CREATE INDEX IF NOT EXISTS idx_catalog_episodes_series ON catalog_episodes(series_title_id, season_number, episode_number);
CREATE INDEX IF NOT EXISTS idx_library_user_status ON user_library_items(user_id, status, updated_at);
CREATE INDEX IF NOT EXISTS idx_watch_events_user_date ON watch_events(user_id, watched_at);
CREATE INDEX IF NOT EXISTS idx_import_jobs_user ON import_jobs(user_id, created_at);
