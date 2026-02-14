import type { Denylist, CreateDenylistInput } from "@focus-reader/shared";
import { nowISO } from "@focus-reader/shared";

export async function isDomainDenied(
  db: D1Database,
  domain: string
): Promise<boolean> {
  const result = await db
    .prepare("SELECT 1 FROM denylist WHERE domain = ?1")
    .bind(domain.toLowerCase())
    .first();
  return result !== null;
}

export async function listDenylistEntries(
  db: D1Database
): Promise<Denylist[]> {
  const rows = await db
    .prepare("SELECT * FROM denylist ORDER BY created_at DESC")
    .all<Denylist>();
  return rows.results;
}

export async function addDenylistEntry(
  db: D1Database,
  input: CreateDenylistInput
): Promise<Denylist> {
  const id = crypto.randomUUID();
  const now = nowISO();
  await db
    .prepare(
      "INSERT INTO denylist (id, domain, reason, created_at) VALUES (?1, ?2, ?3, ?4)"
    )
    .bind(id, input.domain.toLowerCase(), input.reason ?? null, now)
    .run();

  return (await db
    .prepare("SELECT * FROM denylist WHERE id = ?1")
    .bind(id)
    .first<Denylist>())!;
}

export async function removeDenylistEntry(
  db: D1Database,
  id: string
): Promise<void> {
  await db
    .prepare("DELETE FROM denylist WHERE id = ?1")
    .bind(id)
    .run();
}
