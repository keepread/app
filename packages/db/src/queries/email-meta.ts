import type {
  DocumentEmailMeta,
  CreateEmailMetaInput,
} from "@focus-reader/shared";
import { nowISO } from "@focus-reader/shared";

export async function createEmailMeta(
  db: D1Database,
  input: CreateEmailMetaInput
): Promise<DocumentEmailMeta> {
  const stmt = db.prepare(`
    INSERT INTO document_email_meta (
      document_id, message_id, fingerprint, from_address, from_name,
      raw_headers, is_rejected, rejection_reason,
      needs_confirmation, delivery_attempts
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
  `);
  await stmt
    .bind(
      input.document_id,
      input.message_id ?? null,
      input.fingerprint ?? null,
      input.from_address,
      input.from_name ?? null,
      input.raw_headers ?? null,
      input.is_rejected ?? 0,
      input.rejection_reason ?? null,
      input.needs_confirmation ?? 0,
      input.delivery_attempts ?? 1
    )
    .run();

  return (await db
    .prepare("SELECT * FROM document_email_meta WHERE document_id = ?1")
    .bind(input.document_id)
    .first<DocumentEmailMeta>())!;
}

export async function getEmailMetaByDocumentId(
  db: D1Database,
  documentId: string
): Promise<DocumentEmailMeta | null> {
  const result = await db
    .prepare("SELECT * FROM document_email_meta WHERE document_id = ?1")
    .bind(documentId)
    .first<DocumentEmailMeta>();
  return result ?? null;
}

export async function getEmailMetaByMessageId(
  db: D1Database,
  messageId: string
): Promise<DocumentEmailMeta | null> {
  const result = await db
    .prepare(
      "SELECT * FROM document_email_meta WHERE message_id = ?1"
    )
    .bind(messageId)
    .first<DocumentEmailMeta>();
  return result ?? null;
}

export async function getEmailMetaByFingerprint(
  db: D1Database,
  fingerprint: string
): Promise<DocumentEmailMeta | null> {
  const result = await db
    .prepare(
      "SELECT * FROM document_email_meta WHERE fingerprint = ?1"
    )
    .bind(fingerprint)
    .first<DocumentEmailMeta>();
  return result ?? null;
}

export async function incrementDeliveryAttempts(
  db: D1Database,
  documentId: string
): Promise<void> {
  const now = nowISO();
  await db
    .prepare(
      "UPDATE document_email_meta SET delivery_attempts = delivery_attempts + 1 WHERE document_id = ?1"
    )
    .bind(documentId)
    .run();
  // Also update the document's updated_at
  await db
    .prepare("UPDATE document SET updated_at = ?1 WHERE id = ?2")
    .bind(now, documentId)
    .run();
}
