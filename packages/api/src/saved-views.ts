import type {
  SavedView,
  CreateSavedViewInput,
  UpdateSavedViewInput,
  ViewQueryAst,
  ViewFilter,
  ListDocumentsQuery,
  ViewSortConfig,
} from "@focus-reader/shared";
import type { UserScopedDb } from "@focus-reader/db";
import {
  listSavedViews as dbListSavedViews,
  createSavedView as dbCreateSavedView,
  updateSavedView as dbUpdateSavedView,
  deleteSavedView as dbDeleteSavedView,
} from "@focus-reader/db";

export async function getSavedViews(ctx: UserScopedDb): Promise<SavedView[]> {
  return dbListSavedViews(ctx);
}

export async function createView(
  ctx: UserScopedDb,
  input: CreateSavedViewInput
): Promise<SavedView> {
  return dbCreateSavedView(ctx, input);
}

export async function updateView(
  ctx: UserScopedDb,
  id: string,
  updates: UpdateSavedViewInput
): Promise<void> {
  return dbUpdateSavedView(ctx, id, updates);
}

export async function deleteView(
  ctx: UserScopedDb,
  id: string
): Promise<void> {
  return dbDeleteSavedView(ctx, id);
}

export function queryAstToDocumentQuery(ast: ViewQueryAst): Partial<ListDocumentsQuery> {
  const query: Partial<ListDocumentsQuery> = {};

  for (const filter of ast.filters) {
    applyFilter(query, filter);
  }

  return query;
}

function applyFilter(
  query: Partial<ListDocumentsQuery>,
  filter: ViewFilter
): void {
  const { field, operator, value } = filter;

  switch (field) {
    case "type":
      if (operator === "eq") {
        query.type = value as ListDocumentsQuery["type"];
      }
      break;
    case "location":
      if (operator === "eq") {
        query.location = value as ListDocumentsQuery["location"];
      }
      break;
    case "is_read":
      if (operator === "eq") {
        query.status = Number(value) === 1 ? "read" : "unread";
      }
      break;
    case "is_starred":
      if (operator === "eq" && Number(value) === 1) {
        query.isStarred = true;
      }
      break;
    case "tag":
      if (operator === "eq") {
        query.tagId = String(value);
      }
      break;
    case "source_id":
      if (operator === "eq") {
        // Could be subscription or feed — set both, listDocuments handles source_id
        query.subscriptionId = String(value);
      }
      break;
    case "saved_after":
      query.savedAfter = String(value);
      break;
    case "saved_before":
      query.savedBefore = String(value);
      break;
  }
}

export function applySortConfig(
  query: Partial<ListDocumentsQuery>,
  sortConfig: ViewSortConfig
): Partial<ListDocumentsQuery> {
  return {
    ...query,
    sortBy: sortConfig.field,
    sortDir: sortConfig.direction,
  };
}
