import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:test";
import { INITIAL_SCHEMA_SQL, MULTI_TENANCY_SQL, AUTH_HYBRID_SQL } from "../migration-sql.js";

/**
 * Schema/type drift test.
 * Runs the migration against a fresh D1 instance, introspects the resulting
 * table structure via PRAGMA table_info(...), and compares column names
 * against the TypeScript interfaces in @focus-reader/shared.
 *
 * This catches manual drift between the SQL migration and the TS types
 * without requiring a codegen tool.
 */

// Map of table name -> expected column names from TypeScript interfaces
const EXPECTED_COLUMNS: Record<string, string[]> = {
  user: [
    "id", "email", "email_verified", "slug", "name", "avatar_url",
    "is_admin", "is_active", "created_at", "updated_at",
  ],
  document: [
    "id", "user_id", "type", "url", "title", "author", "author_url", "site_name", "excerpt",
    "word_count", "reading_time_minutes", "cover_image_url",
    "html_content", "markdown_content", "plain_text_content",
    "location", "is_read", "is_starred", "reading_progress",
    "last_read_at", "saved_at", "published_at", "lang", "updated_at", "deleted_at",
    "source_id", "origin_type",
  ],
  document_email_meta: [
    "document_id", "message_id", "fingerprint", "from_address", "from_name",
    "raw_headers", "is_rejected", "rejection_reason",
    "needs_confirmation", "delivery_attempts",
  ],
  subscription: [
    "id", "user_id", "pseudo_email", "display_name", "sender_address", "sender_name",
    "is_active", "auto_tag_rules", "created_at", "updated_at", "deleted_at",
  ],
  tag: [
    "id", "user_id", "name", "color", "description", "created_at",
  ],
  attachment: [
    "id", "document_id", "filename", "content_type", "size_bytes",
    "content_id", "storage_key", "created_at",
  ],
  denylist: [
    "id", "user_id", "domain", "reason", "created_at",
  ],
  ingestion_log: [
    "id", "user_id", "event_id", "document_id", "channel_type", "received_at",
    "status", "error_code", "error_detail", "attempts",
  ],
  feed: [
    "id", "user_id", "feed_url", "site_url", "title", "description", "icon_url",
    "last_fetched_at", "fetch_interval_minutes", "is_active", "fetch_full_content",
    "auto_tag_rules", "error_count", "last_error",
    "created_at", "updated_at", "deleted_at",
  ],
  document_pdf_meta: [
    "document_id", "page_count", "file_size_bytes", "storage_key",
  ],
  highlight: [
    "id", "user_id", "document_id", "text", "note", "color",
    "position_selector", "position_percent",
    "created_at", "updated_at",
  ],
  collection: [
    "id", "user_id", "name", "description", "created_at", "updated_at",
  ],
  feed_token: [
    "id", "user_id", "token_hash", "label", "created_at", "revoked_at",
  ],
  api_key: [
    "id", "user_id", "key_hash", "key_prefix", "label",
    "last_used_at", "created_at", "revoked_at",
  ],
  saved_view: [
    "id", "user_id", "name", "query_ast_json", "sort_json", "is_system",
    "pinned_order", "created_at", "updated_at", "deleted_at",
  ],
  user_preferences: [
    "id", "schema_version", "theme", "font_family", "font_size",
    "line_height", "content_width", "shortcut_map_json",
    "view_mode_prefs_json", "updated_at",
  ],
  ingestion_report_daily: [
    "user_id", "report_date", "total_events", "success_count", "failure_count",
    "success_rate", "computed_at",
  ],
  // Join tables
  document_tags: ["document_id", "tag_id"],
  subscription_tags: ["subscription_id", "tag_id"],
  feed_tags: ["feed_id", "tag_id"],
  highlight_tags: ["highlight_id", "tag_id"],
  collection_documents: ["collection_id", "document_id", "sort_order", "added_at"],
};

async function applyMigration(db: D1Database) {
  const allSql = INITIAL_SCHEMA_SQL + "\n" + MULTI_TENANCY_SQL + "\n" + AUTH_HYBRID_SQL;
  const statements = allSql
    .split(";")
    .map((s) => s.trim())
    .filter(
      (s) =>
        s.length > 0 &&
        !s.startsWith("--") &&
        !s.match(/^--/) &&
        s.includes(" ")
    );

  for (const stmt of statements) {
    await db.prepare(stmt).run();
  }
}

interface PragmaColumn {
  name: string;
  type: string;
}

describe("schema/type drift", () => {
  beforeAll(async () => {
    await applyMigration(env.FOCUS_DB);
  });

  for (const [tableName, expectedCols] of Object.entries(EXPECTED_COLUMNS)) {
    it(`table "${tableName}" columns match TypeScript interface`, async () => {
      const result = await env.FOCUS_DB.prepare(
        `PRAGMA table_info(${tableName})`
      ).all<PragmaColumn>();

      const actualCols = result.results.map((r) => r.name).sort();
      const expected = [...expectedCols].sort();

      expect(actualCols).toEqual(expected);
    });
  }
});
