import type { DocumentLocation } from "@focus-reader/shared";
import type { UserScopedDb } from "@focus-reader/db";
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

export async function exportAllJson(ctx: UserScopedDb): Promise<object> {
  const [documents, tags, feeds, subscriptions, collections, preferences] =
    await Promise.all([
      listDocuments(ctx, { limit: 10000 }),
      listTags(ctx),
      listFeeds(ctx),
      listSubscriptions(ctx),
      listCollections(ctx),
      getUserPreferences(ctx),
    ]);

  // Get all highlights
  const allHighlights = await listAllHighlights(ctx, { limit: 10000 });

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
  ctx: UserScopedDb,
  documentId: string,
  options?: {
    includeHighlights?: boolean;
    highlightFormat?: "inline" | "appendix";
  }
): Promise<string | null> {
  const doc = await getDocument(ctx, documentId);
  if (!doc) return null;

  const [tags, highlights] = await Promise.all([
    getTagsForDocument(ctx, documentId),
    listHighlightsForDocument(ctx, documentId),
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
  ctx: UserScopedDb,
  options?: {
    tagId?: string;
    location?: DocumentLocation;
    includeHighlights?: boolean;
  }
): Promise<{ filename: string; content: string }[]> {
  const docs = await listDocuments(ctx, {
    limit: 10000,
    tagId: options?.tagId,
    location: options?.location,
  });

  const files: { filename: string; content: string }[] = [];
  for (const doc of docs.items) {
    const md = await exportDocumentMarkdown(ctx, doc.id, {
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
  ctx: UserScopedDb,
  options?: { tagId?: string; documentId?: string }
): Promise<string> {
  if (options?.documentId) {
    const highlights = await listHighlightsForDocument(ctx, options.documentId);
    const doc = await getDocument(ctx, options.documentId);
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

  const result = await listAllHighlights(ctx, {
    limit: 10000,
    tagId: options?.tagId,
  });
  return formatHighlightsAsMarkdown(result.items);
}
