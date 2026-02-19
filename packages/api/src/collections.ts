import type {
  Collection,
  CreateCollectionInput,
  UpdateCollectionInput,
  CollectionWithCount,
  CollectionWithDocuments,
} from "@focus-reader/shared";
import type { UserScopedDb } from "@focus-reader/db";
import {
  createCollection as dbCreateCollection,
  getCollection,
  listCollections,
  updateCollection,
  deleteCollection,
  addDocumentToCollection,
  removeDocumentFromCollection,
  getCollectionDocuments,
  reorderCollectionDocuments,
  getCollectionsForDocument,
} from "@focus-reader/db";

export async function getCollections(ctx: UserScopedDb): Promise<CollectionWithCount[]> {
  return listCollections(ctx);
}

export async function getCollectionDetail(ctx: UserScopedDb, id: string): Promise<CollectionWithDocuments | null> {
  const collection = await getCollection(ctx, id);
  if (!collection) return null;
  const documents = await getCollectionDocuments(ctx, id);
  return { ...collection, documents };
}

export async function createCollection(ctx: UserScopedDb, input: CreateCollectionInput): Promise<Collection> {
  return dbCreateCollection(ctx, input);
}

export async function patchCollection(ctx: UserScopedDb, id: string, updates: UpdateCollectionInput): Promise<void> {
  await updateCollection(ctx, id, updates);
}

export async function removeCollection(ctx: UserScopedDb, id: string): Promise<void> {
  await deleteCollection(ctx, id);
}

export async function addToCollection(ctx: UserScopedDb, collectionId: string, documentId: string): Promise<void> {
  await addDocumentToCollection(ctx, collectionId, documentId);
}

export async function removeFromCollection(ctx: UserScopedDb, collectionId: string, documentId: string): Promise<void> {
  await removeDocumentFromCollection(ctx, collectionId, documentId);
}

export async function getDocumentCollections(ctx: UserScopedDb, documentId: string): Promise<Collection[]> {
  return getCollectionsForDocument(ctx, documentId);
}

export async function reorderCollection(ctx: UserScopedDb, collectionId: string, orderedDocumentIds: string[]): Promise<void> {
  await reorderCollectionDocuments(ctx, collectionId, orderedDocumentIds);
}
