export interface ExtensionConfig {
  apiUrl: string;
  apiKey: string;
}

export async function getConfig(): Promise<ExtensionConfig | null> {
  const result = await browser.storage.sync.get(["apiUrl", "apiKey"]);
  if (!result.apiUrl || !result.apiKey) return null;
  return { apiUrl: result.apiUrl as string, apiKey: result.apiKey as string };
}

export async function saveConfig(config: ExtensionConfig): Promise<void> {
  await browser.storage.sync.set({ apiUrl: config.apiUrl, apiKey: config.apiKey });
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const config = await getConfig();
  if (!config) throw new Error("Extension not configured. Set API URL and key in options.");

  const url = `${config.apiUrl.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const msg = body?.error?.message ?? `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return res;
}

// --- Types (local to extension, no shared dependency) ---

export interface DocumentDetail {
  id: string;
  type: string;
  url: string | null;
  title: string;
  author: string | null;
  excerpt: string | null;
  site_name: string | null;
  cover_image_url: string | null;
  location: string;
  is_read: number;
  is_starred: number;
  reading_progress: number;
  saved_at: string;
  tags: Tag[];
}

export interface Tag {
  id: string;
  name: string;
  color: string | null;
}

export interface Collection {
  id: string;
  name: string;
  description: string | null;
  document_count?: number;
}

// --- Existing methods ---

export interface SavePageOptions {
  type?: "article" | "bookmark";
  tagIds?: string[];
}

export async function savePage(
  url: string,
  html: string | null,
  options?: SavePageOptions
): Promise<unknown> {
  const res = await request("/api/documents", {
    method: "POST",
    body: JSON.stringify({
      url,
      type: options?.type ?? "article",
      html,
      tagIds: options?.tagIds,
    }),
  });
  return res.json();
}

export async function getTags(): Promise<Tag[]> {
  const res = await request("/api/tags");
  return res.json();
}

export async function testConnection(): Promise<boolean> {
  try {
    await getTags();
    return true;
  } catch {
    return false;
  }
}

// --- New methods ---

export async function lookupByUrl(url: string): Promise<DocumentDetail | null> {
  try {
    const res = await request(`/api/documents/lookup?url=${encodeURIComponent(url)}`);
    return res.json();
  } catch (err) {
    if (err instanceof Error && err.message.includes("404")) return null;
    // For "Document not found" errors from our API
    if (err instanceof Error && err.message === "Document not found") return null;
    throw err;
  }
}

export async function updateDocument(
  id: string,
  patch: Record<string, unknown>
): Promise<void> {
  await request(`/api/documents/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteDocument(id: string): Promise<void> {
  await request(`/api/documents/${id}`, {
    method: "DELETE",
  });
}

export async function getCollections(): Promise<Collection[]> {
  const res = await request("/api/collections");
  return res.json();
}

export async function addToCollection(
  collectionId: string,
  documentId: string
): Promise<void> {
  await request(`/api/collections/${collectionId}/documents`, {
    method: "POST",
    body: JSON.stringify({ documentId }),
  });
}

export async function getDocuments(query?: {
  location?: string;
  isStarred?: boolean;
  limit?: number;
  cursor?: string;
}): Promise<{ items: DocumentDetail[]; total: number; nextCursor?: string }> {
  const params = new URLSearchParams();
  if (query?.location) params.set("location", query.location);
  if (query?.isStarred) params.set("isStarred", "true");
  if (query?.limit) params.set("limit", String(query.limit));
  if (query?.cursor) params.set("cursor", query.cursor);

  const qs = params.toString();
  const res = await request(`/api/documents${qs ? `?${qs}` : ""}`);
  return res.json();
}
