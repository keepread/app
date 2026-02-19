import type {
  ListDocumentsQuery,
  PaginatedResponse,
  DocumentWithTags,
  UpdateDocumentInput,
  Document,
} from "@focus-reader/shared";
import { normalizeUrl } from "@focus-reader/shared";
import type { UserScopedDb } from "@focus-reader/db";
import {
  listDocuments,
  getDocumentWithTags,
  updateDocument,
  softDeleteDocument,
  createDocument,
  getDocumentByUrl,
  createPdfMeta,
} from "@focus-reader/db";
import { extractArticle, extractMetadata, extractPdfMetadata } from "@focus-reader/parser";
import { tagDocument } from "./tags.js";

export async function getDocuments(
  ctx: UserScopedDb,
  query: ListDocumentsQuery
): Promise<PaginatedResponse<DocumentWithTags>> {
  const result = await listDocuments(ctx, query);

  // Enrich each document with tags
  const enriched: DocumentWithTags[] = [];
  for (const doc of result.items) {
    const withTags = await getDocumentWithTags(ctx, doc.id);
    if (withTags) enriched.push(withTags);
  }

  return {
    items: enriched,
    total: result.total,
    nextCursor: result.nextCursor,
  };
}

export async function getDocumentDetail(
  ctx: UserScopedDb,
  id: string
): Promise<DocumentWithTags | null> {
  return getDocumentWithTags(ctx, id);
}

export async function patchDocument(
  ctx: UserScopedDb,
  id: string,
  updates: UpdateDocumentInput
): Promise<void> {
  await updateDocument(ctx, id, updates);
}

export async function removeDocument(
  ctx: UserScopedDb,
  id: string
): Promise<void> {
  await softDeleteDocument(ctx, id);
}

export async function createBookmark(
  ctx: UserScopedDb,
  url: string,
  options?: { type?: "article" | "bookmark"; html?: string | null; tagIds?: string[] }
): Promise<Document> {
  // Normalize URL for deduplication
  const normalized = normalizeUrl(url);

  // Check for duplicate
  const existing = await getDocumentByUrl(ctx, normalized);
  if (existing) {
    throw new DuplicateUrlError(existing.id);
  }

  // Use provided HTML or fetch the page
  let html: string | null = options?.html ?? null;
  if (!html) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "FocusReader/1.0" },
        redirect: "follow",
      });
      if (response.ok) {
        html = await response.text();
      }
    } catch {
      // Fetch failed — create a bare bookmark with URL as title
    }
  }

  const type = options?.type ?? "bookmark";
  const tagIds = options?.tagIds ?? [];

  if (html) {
    // Try full article extraction first
    const article = extractArticle(html, url);
    if (article.title && article.htmlContent) {
      // Extract metadata for supplementary info (OG image, favicon)
      const meta = extractMetadata(html, url);

      const doc = await createDocument(ctx, {
        type,
        url: normalized,
        title: article.title,
        author: article.author,
        excerpt: article.excerpt,
        word_count: article.wordCount,
        reading_time_minutes: article.readingTimeMinutes,
        site_name: article.siteName || meta.siteName,
        cover_image_url: meta.ogImage,
        html_content: article.htmlContent,
        markdown_content: article.markdownContent,
        published_at: meta.publishedDate,
        origin_type: "manual",
      });
      for (const tagId of tagIds) await tagDocument(ctx, doc.id, tagId);
      return doc;
    }

    // Fallback: use OG metadata only (lightweight bookmark)
    const meta = extractMetadata(html, url);
    const doc = await createDocument(ctx, {
      type: "bookmark",
      url: normalized,
      title: meta.title || url,
      author: meta.author,
      excerpt: meta.description,
      site_name: meta.siteName,
      cover_image_url: meta.ogImage,
      published_at: meta.publishedDate,
      origin_type: "manual",
    });
    for (const tagId of tagIds) await tagDocument(ctx, doc.id, tagId);
    return doc;
  }

  // No HTML available — bare bookmark
  const doc = await createDocument(ctx, {
    type: "bookmark",
    url: normalized,
    title: url,
    origin_type: "manual",
  });
  for (const tagId of tagIds) await tagDocument(ctx, doc.id, tagId);
  return doc;
}

export async function createPdfDocument(
  ctx: UserScopedDb,
  r2: R2Bucket,
  file: ArrayBuffer,
  filename: string
): Promise<Document> {
  const docId = crypto.randomUUID();
  const storageKey = `pdfs/${docId}/${filename}`;

  // Upload to R2
  await r2.put(storageKey, file, {
    httpMetadata: { contentType: "application/pdf" },
  });

  // Extract metadata
  const metadata = extractPdfMetadata(file, filename);

  // Create document
  const doc = await createDocument(ctx, {
    id: docId,
    type: "pdf",
    title: metadata.title ?? filename,
    origin_type: "manual",
    location: "inbox",
  });

  // Create PDF metadata (child entity — uses raw db)
  await createPdfMeta(ctx.db, {
    document_id: docId,
    page_count: metadata.pageCount,
    file_size_bytes: metadata.fileSizeBytes,
    storage_key: storageKey,
  });

  return doc;
}

export async function getDocumentByUrlDetail(
  ctx: UserScopedDb,
  url: string
): Promise<DocumentWithTags | null> {
  const normalized = normalizeUrl(url);
  const doc = await getDocumentByUrl(ctx, normalized);
  if (!doc) return null;
  return getDocumentWithTags(ctx, doc.id);
}

export class DuplicateUrlError extends Error {
  public existingId: string;
  constructor(existingId: string) {
    super("This URL is already saved");
    this.name = "DuplicateUrlError";
    this.existingId = existingId;
  }
}
