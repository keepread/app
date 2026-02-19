import { NextRequest } from "next/server";
import { getDocuments, createBookmark, DuplicateUrlError } from "@focus-reader/api";
import type { ListDocumentsQuery, DocumentLocation, DocumentType, SortField, SortDirection } from "@focus-reader/shared";
import { scopeDb } from "@focus-reader/db";
import { getDb } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";
import { withAuth } from "@/lib/auth-middleware";
import { withCors, handlePreflight } from "@/lib/cors";

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  return withAuth(request, async (userId) => {
    try {
      const db = await getDb();
      const ctx = scopeDb(db, userId);
      const params = request.nextUrl.searchParams;

      const query: ListDocumentsQuery = {
        location: (params.get("location") as DocumentLocation) || undefined,
        status: (params.get("status") as "read" | "unread") || undefined,
        tagId: params.get("tagId") || undefined,
        subscriptionId: params.get("subscriptionId") || undefined,
        feedId: params.get("feedId") || undefined,
        type: (params.get("type") as DocumentType) || undefined,
        search: params.get("search") || undefined,
        sortBy: (params.get("sortBy") as SortField) || undefined,
        sortDir: (params.get("sortDir") as SortDirection) || undefined,
        cursor: params.get("cursor") || undefined,
        limit: params.get("limit") ? parseInt(params.get("limit")!) : undefined,
        isStarred: params.get("isStarred") === "true" || undefined,
        savedAfter: params.get("savedAfter") || undefined,
        savedBefore: params.get("savedBefore") || undefined,
      };

      const result = await getDocuments(ctx, query);
      return withCors(json(result), origin);
    } catch (err) {
      return withCors(jsonError("Failed to fetch documents", "FETCH_ERROR", 500), origin);
    }
  });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  return withAuth(request, async (userId) => {
    try {
      const db = await getDb();
      const ctx = scopeDb(db, userId);
      const body = (await request.json()) as Record<string, unknown>;
      const { url, type, html, tagIds } = body as {
        url?: string;
        type?: "article" | "bookmark";
        html?: string | null;
        tagIds?: string[];
      };

      if (!url) {
        return withCors(jsonError("URL is required", "MISSING_URL", 400), origin);
      }

      const doc = await createBookmark(ctx, url, { type, html, tagIds });
      return withCors(json(doc, 201), origin);
    } catch (err) {
      if (err instanceof DuplicateUrlError) {
        return withCors(jsonError("This URL is already saved", "DUPLICATE_URL", 409), origin);
      }
      return withCors(jsonError("Failed to create document", "CREATE_ERROR", 500), origin);
    }
  });
}

export async function OPTIONS(request: NextRequest) {
  return handlePreflight(request.headers.get("origin"));
}
