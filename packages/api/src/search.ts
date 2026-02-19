import type {
  DocumentLocation,
  DocumentType,
  DocumentWithTags,
  PaginatedResponse,
} from "@focus-reader/shared";
import type { UserScopedDb } from "@focus-reader/db";
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
  ctx: UserScopedDb,
  query: SearchDocumentsQuery
): Promise<PaginatedResponse<DocumentWithTags & { snippet: string }>> {
  const { results, total } = await dbSearch(ctx, query.q, {
    limit: query.limit,
    offset: query.offset,
    location: query.location,
    type: query.type,
    tagId: query.tagId,
  });

  const items: (DocumentWithTags & { snippet: string })[] = [];
  for (const result of results) {
    const doc = await getDocumentWithTags(ctx, result.documentId);
    if (doc) {
      items.push({ ...doc, snippet: result.snippet });
    }
  }

  return { items, total };
}
