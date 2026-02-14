import { NextRequest } from "next/server";
import { getDocuments, createBookmark, DuplicateUrlError } from "@focus-reader/api";
import type { ListDocumentsQuery, DocumentLocation, SortField, SortDirection } from "@focus-reader/shared";
import { getDb } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const params = request.nextUrl.searchParams;

    const query: ListDocumentsQuery = {
      location: (params.get("location") as DocumentLocation) || undefined,
      status: (params.get("status") as "read" | "unread") || undefined,
      tagId: params.get("tagId") || undefined,
      subscriptionId: params.get("subscriptionId") || undefined,
      search: params.get("search") || undefined,
      sortBy: (params.get("sortBy") as SortField) || undefined,
      sortDir: (params.get("sortDir") as SortDirection) || undefined,
      cursor: params.get("cursor") || undefined,
      limit: params.get("limit") ? parseInt(params.get("limit")!) : undefined,
      isStarred: params.get("isStarred") === "true" || undefined,
    };

    const result = await getDocuments(db, query);
    return json(result);
  } catch (err) {
    return jsonError("Failed to fetch documents", "FETCH_ERROR", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDb();
    const body = (await request.json()) as Record<string, unknown>;
    const { url, type } = body as { url?: string; type?: "article" | "bookmark" };

    if (!url) {
      return jsonError("URL is required", "MISSING_URL", 400);
    }

    const doc = await createBookmark(db, url, { type });
    return json(doc, 201);
  } catch (err) {
    if (err instanceof DuplicateUrlError) {
      return jsonError("This URL is already saved", "DUPLICATE_URL", 409);
    }
    return jsonError("Failed to create document", "CREATE_ERROR", 500);
  }
}
