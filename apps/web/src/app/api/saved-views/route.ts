import { NextRequest } from "next/server";
import { getSavedViews, createView } from "@focus-reader/api";
import { scopeDb } from "@focus-reader/db";
import { getDb } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";
import { withAuth } from "@/lib/auth-middleware";

const DEFAULT_VIEWS = [
  {
    name: "Newsletters",
    query_ast_json:
      '{"filters":[{"field":"type","operator":"eq","value":"email"}],"combinator":"and"}',
    is_system: 1,
    pinned_order: 1,
  },
  {
    name: "RSS",
    query_ast_json:
      '{"filters":[{"field":"type","operator":"eq","value":"rss"}],"combinator":"and"}',
    is_system: 1,
    pinned_order: 2,
  },
  {
    name: "Recently Read",
    query_ast_json:
      '{"filters":[{"field":"is_read","operator":"eq","value":1}],"combinator":"and"}',
    sort_json: '{"field":"saved_at","direction":"desc"}',
    is_system: 1,
    pinned_order: 3,
  },
];

export async function GET(request: NextRequest) {
  return withAuth(request, async (userId) => {
    try {
      const db = await getDb();
      const ctx = scopeDb(db, userId);
      let views = await getSavedViews(ctx);

      // Seed default system views if none exist
      if (views.length === 0) {
        for (const defaultView of DEFAULT_VIEWS) {
          await createView(ctx, defaultView);
        }
        views = await getSavedViews(ctx);
      }

      return json(views);
    } catch {
      return jsonError("Failed to list saved views", "FETCH_ERROR", 500);
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (userId) => {
    try {
      const db = await getDb();
      const ctx = scopeDb(db, userId);
      const body = (await request.json()) as Record<string, unknown>;

      if (!body.name || !body.query_ast_json) {
        return jsonError(
          "name and query_ast_json are required",
          "VALIDATION_ERROR",
          400
        );
      }

      const view = await createView(ctx, {
        name: body.name as string,
        query_ast_json: body.query_ast_json as string,
        sort_json: (body.sort_json as string) ?? null,
        pinned_order: (body.pinned_order as number) ?? null,
      });

      return json(view, 201);
    } catch {
      return jsonError("Failed to create saved view", "CREATE_ERROR", 500);
    }
  });
}
