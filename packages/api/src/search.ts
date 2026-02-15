import type {
  DocumentLocation,
  DocumentType,
  DocumentWithTags,
  PaginatedResponse,
} from "@focus-reader/shared";
import {
  searchDocuments as dbSearch,
  getDocumentWithTags,
} from "@focus-reader/db";

export interface SearchDocumentsQuery {
  q: string;
  location?: DocumentLocation;
  type?: DocumentType;
  tagId?: string;
  limit?: number;
  offset?: number;
}

export async function searchDocuments(
  db: D1Database,
  query: SearchDocumentsQuery
): Promise<PaginatedResponse<DocumentWithTags & { snippet: string }>> {
  const { results, total } = await dbSearch(db, query.q, {
    limit: query.limit,
    offset: query.offset,
    location: query.location,
    type: query.type,
    tagId: query.tagId,
  });

  const items: (DocumentWithTags & { snippet: string })[] = [];
  for (const result of results) {
    const doc = await getDocumentWithTags(db, result.documentId);
    if (doc) {
      items.push({ ...doc, snippet: result.snippet });
    }
  }

  return { items, total };
}
