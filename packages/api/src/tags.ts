import type {
  TagWithCount,
  Tag,
  CreateTagInput,
  UpdateTagInput,
} from "@focus-reader/shared";
import type { UserScopedDb } from "@focus-reader/db";
import {
  listTags,
  createTag,
  updateTag,
  deleteTag,
  addTagToDocument,
  removeTagFromDocument,
  addTagToSubscription,
  removeTagFromSubscription,
} from "@focus-reader/db";

export async function getTags(ctx: UserScopedDb): Promise<TagWithCount[]> {
  return listTags(ctx);
}

export async function createNewTag(ctx: UserScopedDb, input: CreateTagInput): Promise<Tag> {
  return createTag(ctx, input);
}

export async function patchTag(ctx: UserScopedDb, id: string, updates: UpdateTagInput): Promise<void> {
  await updateTag(ctx, id, updates);
}

export async function removeTag(ctx: UserScopedDb, id: string): Promise<void> {
  await deleteTag(ctx, id);
}

export async function tagDocument(ctx: UserScopedDb, documentId: string, tagId: string): Promise<void> {
  await addTagToDocument(ctx, documentId, tagId);
}

export async function untagDocument(ctx: UserScopedDb, documentId: string, tagId: string): Promise<void> {
  await removeTagFromDocument(ctx, documentId, tagId);
}

export async function tagSubscription(ctx: UserScopedDb, subscriptionId: string, tagId: string): Promise<void> {
  await addTagToSubscription(ctx, subscriptionId, tagId);
}

export async function untagSubscription(ctx: UserScopedDb, subscriptionId: string, tagId: string): Promise<void> {
  await removeTagFromSubscription(ctx, subscriptionId, tagId);
}
