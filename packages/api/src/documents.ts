import type {
  ListDocumentsQuery,
  PaginatedResponse,
  DocumentWithTags,
  UpdateDocumentInput,
  Document,
} from "@focus-reader/shared";
import { nowISO } from "@focus-reader/shared";
import {
  listDocuments,
  getDocumentWithTags,
  updateDocument,
  softDeleteDocument,
  createDocument,
  getDocumentByUrl,
} from "@focus-reader/db";

export async function getDocuments(
  db: D1Database,
  query: ListDocumentsQuery
): Promise<PaginatedResponse<DocumentWithTags>> {
  const result = await listDocuments(db, query);

  // Enrich each document with tags
  const enriched: DocumentWithTags[] = [];
  for (const doc of result.items) {
    const withTags = await getDocumentWithTags(db, doc.id);
    if (withTags) enriched.push(withTags);
  }

  return {
    items: enriched,
    total: result.total,
    nextCursor: result.nextCursor,
  };
}

export async function getDocumentDetail(
  db: D1Database,
  id: string
): Promise<DocumentWithTags | null> {
  return getDocumentWithTags(db, id);
}

export async function patchDocument(
  db: D1Database,
  id: string,
  updates: UpdateDocumentInput
): Promise<void> {
  await updateDocument(db, id, updates);
}

export async function removeDocument(
  db: D1Database,
  id: string
): Promise<void> {
  await softDeleteDocument(db, id);
}

export async function createBookmark(
  db: D1Database,
  url: string,
  options?: { type?: "article" | "bookmark" }
): Promise<Document> {
  // Check for duplicate
  const existing = await getDocumentByUrl(db, url);
  if (existing) {
    throw new DuplicateUrlError(existing.id);
  }

  const doc = await createDocument(db, {
    type: options?.type ?? "bookmark",
    url,
    title: url, // Will be updated after extraction
    origin_type: "manual",
  });

  return doc;
}

export class DuplicateUrlError extends Error {
  public existingId: string;
  constructor(existingId: string) {
    super("This URL is already saved");
    this.name = "DuplicateUrlError";
    this.existingId = existingId;
  }
}
