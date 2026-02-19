import type { Denylist, CreateDenylistInput } from "@focus-reader/shared";
import type { UserScopedDb } from "@focus-reader/db";
import {
  listDenylistEntries,
  addDenylistEntry,
  removeDenylistEntry,
} from "@focus-reader/db";

export async function getDenylist(ctx: UserScopedDb): Promise<Denylist[]> {
  return listDenylistEntries(ctx);
}

export async function addToDenylist(
  ctx: UserScopedDb,
  input: CreateDenylistInput
): Promise<Denylist> {
  return addDenylistEntry(ctx, input);
}

export async function removeFromDenylist(
  ctx: UserScopedDb,
  id: string
): Promise<void> {
  await removeDenylistEntry(ctx, id);
}
