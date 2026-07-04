ALTER TABLE catalog_titles ADD COLUMN next_release_type TEXT CHECK (next_release_type IN ('movie', 'episode'));
ALTER TABLE catalog_titles ADD COLUMN next_release_title TEXT;
ALTER TABLE catalog_titles ADD COLUMN next_release_date TEXT;
ALTER TABLE catalog_titles ADD COLUMN next_release_season_number INTEGER;
ALTER TABLE catalog_titles ADD COLUMN next_release_episode_number INTEGER;
ALTER TABLE catalog_titles ADD COLUMN next_release_source TEXT;

CREATE INDEX IF NOT EXISTS idx_catalog_titles_next_release ON catalog_titles(next_release_date);
