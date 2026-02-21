import type { UserScopedDb } from "@focus-reader/db";
import { getDocument, enrichDocument } from "@focus-reader/db";

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
]);

const CONTENT_TYPE_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
};

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

export type ImageCacheStatus =
  | "cached"
  | "already_cached"
  | "skipped"
  | "failed"
  | "document_missing";

export interface ImageCacheResult {
  status: ImageCacheStatus;
  r2Key?: string;
}

export async function cacheDocumentCoverImage(
  ctx: UserScopedDb,
  r2: R2Bucket,
  documentId: string
): Promise<ImageCacheResult> {
  const doc = await getDocument(ctx, documentId);
  if (!doc || doc.deleted_at) return { status: "document_missing" };
  if (doc.cover_image_r2_key) return { status: "already_cached" };
  if (!doc.cover_image_url) return { status: "skipped" };

  try {
    const response = await fetch(doc.cover_image_url, {
      headers: { Accept: "image/*", "User-Agent": "FocusReader/1.0" },
      redirect: "follow",
    });
    if (!response.ok) return { status: "failed" };

    const contentType =
      response.headers.get("content-type")?.split(";")[0]?.trim() || "";
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) return { status: "failed" };

    const body = await response.arrayBuffer();
    if (body.byteLength > MAX_IMAGE_SIZE) return { status: "skipped" };

    const ext = CONTENT_TYPE_TO_EXT[contentType] || "jpg";
    const r2Key = `covers/${documentId}.${ext}`;

    await r2.put(r2Key, body, {
      httpMetadata: { contentType },
    });

    await enrichDocument(ctx, documentId, { cover_image_r2_key: r2Key });

    return { status: "cached", r2Key };
  } catch {
    return { status: "failed" };
  }
}
