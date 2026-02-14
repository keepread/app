import type { Denylist, CreateDenylistInput } from "@focus-reader/shared";
import {
  listDenylistEntries,
  addDenylistEntry,
  removeDenylistEntry,
} from "@focus-reader/db";

export async function getDenylist(db: D1Database): Promise<Denylist[]> {
  return listDenylistEntries(db);
}

export async function addToDenylist(
  db: D1Database,
  input: CreateDenylistInput
): Promise<Denylist> {
  return addDenylistEntry(db, input);
}

export async function removeFromDenylist(
  db: D1Database,
  id: string
): Promise<void> {
  await removeDenylistEntry(db, id);
}
