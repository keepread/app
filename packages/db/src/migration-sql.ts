// Auto-generated from migrations/0001_initial_schema.sql
// This file exists so tests running in workerd can access the migration SQL
// without relying on filesystem reads from __dirname.

export const INITIAL_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS document (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('article', 'pdf', 'email', 'rss', 'bookmark', 'post')),
  url TEXT,
  title TEXT NOT NULL,
  author TEXT,
  author_url TEXT,
  site_name TEXT,
  excerpt TEXT,
  word_count INTEGER NOT NULL DEFAULT 0,
  reading_time_minutes INTEGER NOT NULL DEFAULT 0,
  cover_image_url TEXT,
  html_content TEXT,
  markdown_content TEXT,
  plain_text_content TEXT,
  location TEXT NOT NULL DEFAULT 'inbox' CHECK (location IN ('inbox', 'later', 'archive')),
  is_read INTEGER NOT NULL DEFAULT 0,
  is_starred INTEGER NOT NULL DEFAULT 0,
  reading_progress REAL NOT NULL DEFAULT 0.0,
  last_read_at TEXT,
  saved_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  published_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT,
  source_id TEXT,
  origin_type TEXT NOT NULL CHECK (origin_type IN ('subscription', 'feed', 'manual'))
);

CREATE INDEX IF NOT EXISTS idx_document_location ON document(location);
CREATE INDEX IF NOT EXISTS idx_document_type ON document(type);
CREATE INDEX IF NOT EXISTS idx_document_source_id ON document(source_id);
CREATE INDEX IF NOT EXISTS idx_document_is_read ON document(is_read);
CREATE INDEX IF NOT EXISTS idx_document_is_starred ON document(is_starred);
CREATE INDEX IF NOT EXISTS idx_document_saved_at ON document(saved_at);
CREATE INDEX IF NOT EXISTS idx_document_deleted_at ON document(deleted_at);

CREATE TABLE IF NOT EXISTS document_email_meta (
  document_id TEXT PRIMARY KEY REFERENCES document(id) ON DELETE CASCADE,
  message_id TEXT,
  fingerprint TEXT,
  from_address TEXT NOT NULL,
  from_name TEXT,
  raw_headers TEXT,
  is_rejected INTEGER NOT NULL DEFAULT 0,
  rejection_reason TEXT,
  needs_confirmation INTEGER NOT NULL DEFAULT 0,
  delivery_attempts INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_meta_message_id ON document_email_meta(message_id) WHERE message_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_meta_fingerprint ON document_email_meta(fingerprint) WHERE fingerprint IS NOT NULL;

CREATE TABLE IF NOT EXISTS subscription (
  id TEXT PRIMARY KEY,
  pseudo_email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  sender_address TEXT,
  sender_name TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  auto_tag_rules TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS tag (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS attachment (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  filename TEXT,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  content_id TEXT,
  storage_key TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_attachment_document_id ON attachment(document_id);

CREATE TABLE IF NOT EXISTS denylist (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS ingestion_log (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  document_id TEXT REFERENCES document(id) ON DELETE SET NULL,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('email', 'rss', 'api', 'extension')),
  received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  status TEXT NOT NULL CHECK (status IN ('success', 'failure')),
  error_code TEXT,
  error_detail TEXT,
  attempts INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_ingestion_log_document_id ON ingestion_log(document_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_log_channel_type ON ingestion_log(channel_type);
CREATE INDEX IF NOT EXISTS idx_ingestion_log_status ON ingestion_log(status);
CREATE INDEX IF NOT EXISTS idx_ingestion_log_received_at ON ingestion_log(received_at);

CREATE TABLE IF NOT EXISTS document_tags (
  document_id TEXT NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
  PRIMARY KEY (document_id, tag_id)
);

CREATE TABLE IF NOT EXISTS subscription_tags (
  subscription_id TEXT NOT NULL REFERENCES subscription(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
  PRIMARY KEY (subscription_id, tag_id)
);

CREATE TABLE IF NOT EXISTS feed (
  id TEXT PRIMARY KEY,
  feed_url TEXT NOT NULL UNIQUE,
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
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS document_pdf_meta (
  document_id TEXT PRIMARY KEY REFERENCES document(id) ON DELETE CASCADE,
  page_count INTEGER NOT NULL DEFAULT 0,
  file_size_bytes INTEGER NOT NULL DEFAULT 0,
  storage_key TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS highlight (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  note TEXT,
  color TEXT NOT NULL DEFAULT '#FFFF00',
  position_selector TEXT,
  position_percent REAL NOT NULL DEFAULT 0.0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS collection (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS feed_token (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS api_key (
  id TEXT PRIMARY KEY,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  label TEXT NOT NULL,
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS saved_view (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  query_ast_json TEXT NOT NULL,
  sort_json TEXT,
  is_system INTEGER NOT NULL DEFAULT 0,
  pinned_order INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS user_preferences (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL DEFAULT 1,
  theme TEXT NOT NULL DEFAULT 'light',
  font_family TEXT,
  font_size INTEGER,
  line_height REAL,
  content_width INTEGER,
  shortcut_map_json TEXT,
  view_mode_prefs_json TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS ingestion_report_daily (
  report_date TEXT PRIMARY KEY,
  total_events INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  success_rate REAL NOT NULL DEFAULT 0.0,
  computed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS feed_tags (
  feed_id TEXT NOT NULL REFERENCES feed(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
  PRIMARY KEY (feed_id, tag_id)
);

CREATE TABLE IF NOT EXISTS highlight_tags (
  highlight_id TEXT NOT NULL REFERENCES highlight(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
  PRIMARY KEY (highlight_id, tag_id)
);

CREATE TABLE IF NOT EXISTS collection_documents (
  collection_id TEXT NOT NULL REFERENCES collection(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  added_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (collection_id, document_id)
);
`;

// Auto-generated from migrations/0002_fts5_search.sql
export const FTS5_MIGRATION_SQL = `
CREATE VIRTUAL TABLE IF NOT EXISTS document_fts USING fts5(
  doc_id UNINDEXED,
  title,
  author,
  plain_text_content,
  tokenize='porter unicode61'
);

INSERT INTO document_fts(doc_id, title, author, plain_text_content)
SELECT id, title, COALESCE(author, ''), COALESCE(plain_text_content, '')
FROM document WHERE deleted_at IS NULL;
`;
