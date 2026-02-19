-- Multi-tenancy: Add user table, user_id columns, and composite indexes.
-- A placeholder owner user is inserted so existing rows get a valid user_id.

-- ============================================================
-- 1. Create user table
-- ============================================================

CREATE TABLE user (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT,
  avatar_url TEXT,
  is_admin INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_user_slug ON user(slug);

-- Insert placeholder owner user for existing data
INSERT INTO user (id, email, slug, name, is_admin)
VALUES ('00000000-0000-0000-0000-000000000000', 'owner@placeholder.local', 'owner', 'Owner', 1);

-- ============================================================
-- 2. Add user_id to tables that only need a new column
--    (no UNIQUE constraint changes needed)
-- ============================================================

-- document
ALTER TABLE document ADD COLUMN user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
CREATE INDEX idx_document_user_location ON document(user_id, location);
CREATE INDEX idx_document_user_saved_at ON document(user_id, saved_at);
CREATE INDEX idx_document_user_type ON document(user_id, type);

-- highlight
ALTER TABLE highlight ADD COLUMN user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
CREATE INDEX idx_highlight_user_id ON highlight(user_id);

-- collection
ALTER TABLE collection ADD COLUMN user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
CREATE INDEX idx_collection_user_id ON collection(user_id);

-- api_key
ALTER TABLE api_key ADD COLUMN user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
CREATE INDEX idx_api_key_user_id ON api_key(user_id);

-- feed_token
ALTER TABLE feed_token ADD COLUMN user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
CREATE INDEX idx_feed_token_user_id ON feed_token(user_id);

-- saved_view
ALTER TABLE saved_view ADD COLUMN user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
CREATE INDEX idx_saved_view_user_id ON saved_view(user_id);

-- ingestion_log
ALTER TABLE ingestion_log ADD COLUMN user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
CREATE INDEX idx_ingestion_log_user_id ON ingestion_log(user_id);

-- ============================================================
-- 3. Recreate tables that have UNIQUE constraints changing
--    (SQLite cannot ALTER UNIQUE constraints)
-- ============================================================

-- tag: UNIQUE(name) → UNIQUE(user_id, name)
CREATE TABLE tag_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  name TEXT NOT NULL,
  color TEXT,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(user_id, name)
);
INSERT INTO tag_new (id, name, color, description, created_at)
  SELECT id, name, color, description, created_at FROM tag;
DROP TABLE tag;
ALTER TABLE tag_new RENAME TO tag;
CREATE INDEX idx_tag_user_id ON tag(user_id);

-- subscription: UNIQUE(pseudo_email) → UNIQUE(user_id, pseudo_email)
CREATE TABLE subscription_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  pseudo_email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  sender_address TEXT,
  sender_name TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  auto_tag_rules TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT,
  UNIQUE(user_id, pseudo_email)
);
INSERT INTO subscription_new (id, pseudo_email, display_name, sender_address, sender_name, is_active, auto_tag_rules, created_at, updated_at, deleted_at)
  SELECT id, pseudo_email, display_name, sender_address, sender_name, is_active, auto_tag_rules, created_at, updated_at, deleted_at FROM subscription;
DROP TABLE subscription;
ALTER TABLE subscription_new RENAME TO subscription;
CREATE INDEX idx_subscription_user_id ON subscription(user_id);

-- feed: UNIQUE(feed_url) → UNIQUE(user_id, feed_url)
CREATE TABLE feed_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  feed_url TEXT NOT NULL,
  site_url TEXT,
  title TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  last_fetched_at TEXT,
  fetch_interval_minutes INTEGER NOT NULL DEFAULT 60,
  is_active INTEGER NOT NULL DEFAULT 1,
  fetch_full_content INTEGER NOT NULL DEFAULT 0,
  auto_tag_rules TEXT,
  error_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT,
  UNIQUE(user_id, feed_url)
);
INSERT INTO feed_new (id, feed_url, site_url, title, description, icon_url, last_fetched_at, fetch_interval_minutes, is_active, fetch_full_content, auto_tag_rules, error_count, last_error, created_at, updated_at, deleted_at)
  SELECT id, feed_url, site_url, title, description, icon_url, last_fetched_at, fetch_interval_minutes, is_active, fetch_full_content, auto_tag_rules, error_count, last_error, created_at, updated_at, deleted_at FROM feed;
DROP TABLE feed;
ALTER TABLE feed_new RENAME TO feed;
CREATE INDEX idx_feed_user_id ON feed(user_id);

-- denylist: UNIQUE(domain) → UNIQUE(user_id, domain)
CREATE TABLE denylist_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  domain TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(user_id, domain)
);
INSERT INTO denylist_new (id, domain, reason, created_at)
  SELECT id, domain, reason, created_at FROM denylist;
DROP TABLE denylist;
ALTER TABLE denylist_new RENAME TO denylist;
CREATE INDEX idx_denylist_user_id ON denylist(user_id);

-- ============================================================
-- 4. user_preferences: change from singleton to per-user
-- ============================================================

-- Recreate with user_id as PK approach (id becomes user_id)
-- Existing row with id='default' will be updated after migration
-- by application code to use actual user_id

-- ingestion_report_daily: PK changes to (user_id, report_date)
CREATE TABLE ingestion_report_daily_new (
  user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  report_date TEXT NOT NULL,
  total_events INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  success_rate REAL NOT NULL DEFAULT 0.0,
  computed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, report_date)
);
INSERT INTO ingestion_report_daily_new (report_date, total_events, success_count, failure_count, success_rate, computed_at)
  SELECT report_date, total_events, success_count, failure_count, success_rate, computed_at FROM ingestion_report_daily;
DROP TABLE ingestion_report_daily;
ALTER TABLE ingestion_report_daily_new RENAME TO ingestion_report_daily;
