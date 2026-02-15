import type { DocumentLocation } from "@focus-reader/shared";
import {
  listDocuments,
  getDocument,
  getTagsForDocument,
  listCollections,
  listAllHighlights,
  listHighlightsForDocument,
  listTags,
  listFeeds,
  listSubscriptions,
  getUserPreferences,
} from "@focus-reader/db";
import {
  formatDocumentAsMarkdown,
  formatHighlightsAsMarkdown,
  htmlToMarkdown,
} from "@focus-reader/parser";

export async function exportAllJson(db: D1Database): Promise<object> {
  const [documents, tags, feeds, subscriptions, collections, preferences] =
    await Promise.all([
      listDocuments(db, { limit: 10000 }),
      listTags(db),
      listFeeds(db),
      listSubscriptions(db),
      listCollections(db),
      getUserPreferences(db),
    ]);

  // Get all highlights
  const allHighlights = await listAllHighlights(db, { limit: 10000 });

  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    documents: documents.items,
    tags,
    feeds,
    subscriptions,
    collections,
    highlights: allHighlights.items,
    preferences,
  };
}

export async function exportDocumentMarkdown(
  db: D1Database,
  documentId: string,
  options?: {
    includeHighlights?: boolean;
    highlightFormat?: "inline" | "appendix";
  }
): Promise<string | null> {
  const doc = await getDocument(db, documentId);
  if (!doc) return null;

  const [tags, highlights] = await Promise.all([
    getTagsForDocument(db, documentId),
    listHighlightsForDocument(db, documentId),
  ]);

  const markdownContent = doc.html_content
    ? htmlToMarkdown(doc.html_content)
    : doc.markdown_content ?? null;

  return formatDocumentAsMarkdown(
    { document: doc, tags, highlights, markdownContent },
    {
      includeHighlights: options?.includeHighlights ?? true,
      highlightFormat: options?.highlightFormat ?? "appendix",
    }
  );
}

export async function exportBulkMarkdown(
  db: D1Database,
  options?: {
    tagId?: string;
    location?: DocumentLocation;
    includeHighlights?: boolean;
  }
): Promise<{ filename: string; content: string }[]> {
  const docs = await listDocuments(db, {
    limit: 10000,
    tagId: options?.tagId,
    location: options?.location,
  });

  const files: { filename: string; content: string }[] = [];
  for (const doc of docs.items) {
    const md = await exportDocumentMarkdown(db, doc.id, {
      includeHighlights: options?.includeHighlights ?? true,
    });
    if (md) {
      const slug = doc.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60);
      files.push({ filename: `${slug}.md`, content: md });
    }
  }

  return files;
}

export async function exportHighlightsMarkdown(
  db: D1Database,
  options?: { tagId?: string; documentId?: string }
): Promise<string> {
  if (options?.documentId) {
    const highlights = await listHighlightsForDocument(db, options.documentId);
    const doc = await getDocument(db, options.documentId);
    if (!doc || highlights.length === 0) return "";

    const withDoc = highlights.map((h) => ({
      ...h,
      document: {
        id: doc.id,
        title: doc.title,
        url: doc.url,
        author: doc.author,
        type: doc.type,
      },
    }));
    return formatHighlightsAsMarkdown(withDoc);
  }

  const result = await listAllHighlights(db, {
    limit: 10000,
    tagId: options?.tagId,
  });
  return formatHighlightsAsMarkdown(result.items);
}
