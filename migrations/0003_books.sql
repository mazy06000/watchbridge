CREATE TABLE IF NOT EXISTS book_works (
  id TEXT PRIMARY KEY,
  openlibrary_work_key TEXT UNIQUE,
  google_volume_id TEXT UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  authors_json TEXT NOT NULL DEFAULT '[]',
  description TEXT,
  cover_url TEXT,
  first_publish_year INTEGER,
  subjects_json TEXT NOT NULL DEFAULT '[]',
  source_payload_json TEXT,
  fetched_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS book_editions (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL REFERENCES book_works(id) ON DELETE CASCADE,
  isbn_10 TEXT,
  isbn_13 TEXT,
  title TEXT NOT NULL,
  publisher TEXT,
  published_date TEXT,
  page_count INTEGER,
  language TEXT,
  source_payload_json TEXT,
  fetched_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (work_id, isbn_13),
  UNIQUE (work_id, isbn_10)
);

CREATE TABLE IF NOT EXISTS user_book_library_items (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_id TEXT NOT NULL REFERENCES book_works(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('want_to_read', 'reading', 'read', 'paused', 'dnf')),
  favorite INTEGER NOT NULL DEFAULT 0,
  current_page INTEGER,
  total_pages INTEGER,
  current_percent REAL,
  started_at TEXT,
  finished_at TEXT,
  added_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, work_id)
);

CREATE TABLE IF NOT EXISTS reading_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_id TEXT NOT NULL REFERENCES book_works(id) ON DELETE CASCADE,
  edition_id TEXT REFERENCES book_editions(id) ON DELETE SET NULL,
  pages_read INTEGER,
  minutes_read INTEGER,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  source TEXT NOT NULL CHECK (source IN ('manual', 'import', 'provider')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS book_ratings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_id TEXT NOT NULL REFERENCES book_works(id) ON DELETE CASCADE,
  rating_10 INTEGER NOT NULL CHECK (rating_10 BETWEEN 1 AND 10),
  review_text TEXT,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, work_id)
);

CREATE INDEX IF NOT EXISTS idx_book_works_search ON book_works(title, first_publish_year);
CREATE INDEX IF NOT EXISTS idx_book_editions_work ON book_editions(work_id, published_date);
CREATE INDEX IF NOT EXISTS idx_book_library_user_status ON user_book_library_items(user_id, status, updated_at);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_user_date ON reading_sessions(user_id, started_at);
