import type {
  IngestionLog,
  CreateIngestionLogInput,
} from "@focus-reader/shared";
import { nowISO } from "@focus-reader/shared";
import type { UserScopedDb } from "../scoped-db.js";

export async function listIngestionLogs(
  ctx: UserScopedDb,
  limit = 50
): Promise<IngestionLog[]> {
  const rows = await ctx.db
    .prepare(
      "SELECT * FROM ingestion_log WHERE user_id = ?1 ORDER BY received_at DESC LIMIT ?2"
    )
    .bind(ctx.userId, limit)
    .all<IngestionLog>();
  return rows.results;
}

export async function logIngestionEvent(
  ctx: UserScopedDb,
  input: CreateIngestionLogInput
): Promise<IngestionLog> {
  const id = crypto.randomUUID();
  const now = nowISO();
  const stmt = ctx.db.prepare(`
    INSERT INTO ingestion_log (
      id, user_id, event_id, document_id, channel_type, received_at,
      status, error_code, error_detail, attempts
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
  `);
  await stmt
    .bind(
      id,
      ctx.userId,
      input.event_id,
      input.document_id ?? null,
      input.channel_type,
      now,
      input.status,
      input.error_code ?? null,
      input.error_detail ?? null,
      input.attempts ?? 1
    )
    .run();

  return (await ctx.db
    .prepare("SELECT * FROM ingestion_log WHERE id = ?1")
    .bind(id)
    .first<IngestionLog>())!;
}
