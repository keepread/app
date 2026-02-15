import type {
  Collection,
  CreateCollectionInput,
  UpdateCollectionInput,
  CollectionWithCount,
  CollectionWithDocuments,
} from "@focus-reader/shared";
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

export async function getCollections(
  db: D1Database
): Promise<CollectionWithCount[]> {
  return listCollections(db);
}

export async function getCollectionDetail(
  db: D1Database,
  id: string
): Promise<CollectionWithDocuments | null> {
  const collection = await getCollection(db, id);
  if (!collection) return null;
  const documents = await getCollectionDocuments(db, id);
  return { ...collection, documents };
}

export async function createCollection(
  db: D1Database,
  input: CreateCollectionInput
): Promise<Collection> {
  return dbCreateCollection(db, input);
}

export async function patchCollection(
  db: D1Database,
  id: string,
  updates: UpdateCollectionInput
): Promise<void> {
  await updateCollection(db, id, updates);
}

export async function removeCollection(
  db: D1Database,
  id: string
): Promise<void> {
  await deleteCollection(db, id);
}

export async function addToCollection(
  db: D1Database,
  collectionId: string,
  documentId: string
): Promise<void> {
  await addDocumentToCollection(db, collectionId, documentId);
}

export async function removeFromCollection(
  db: D1Database,
  collectionId: string,
  documentId: string
): Promise<void> {
  await removeDocumentFromCollection(db, collectionId, documentId);
}

export async function getDocumentCollections(
  db: D1Database,
  documentId: string
): Promise<Collection[]> {
  return getCollectionsForDocument(db, documentId);
}

export async function reorderCollection(
  db: D1Database,
  collectionId: string,
  orderedDocumentIds: string[]
): Promise<void> {
  await reorderCollectionDocuments(db, collectionId, orderedDocumentIds);
}
