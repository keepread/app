import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock browser.storage.sync
const mockStorage: Record<string, unknown> = {};
const browserMock = {
  storage: {
    sync: {
      get: vi.fn(async (keys: string[]) => {
        const result: Record<string, unknown> = {};
        for (const key of keys) {
          if (key in mockStorage) result[key] = mockStorage[key];
        }
        return result;
      }),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(mockStorage, items);
      }),
    },
  },
};

// Set global browser mock before importing the module
vi.stubGlobal("browser", browserMock);

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Import after mocks are set up
const {
  getConfig,
  saveConfig,
  savePage,
  getTags,
  testConnection,
  lookupByUrl,
  updateDocument,
  deleteDocument,
  getCollections,
  addToCollection,
} = await import("../lib/api-client");

beforeEach(() => {
  vi.clearAllMocks();
  // Reset storage
  for (const key of Object.keys(mockStorage)) delete mockStorage[key];
});

function configureApi() {
  mockStorage.apiUrl = "https://example.com";
  mockStorage.apiKey = "key123";
}

describe("getConfig", () => {
  it("returns null when not configured", async () => {
    const config = await getConfig();
    expect(config).toBeNull();
  });

  it("returns config when set", async () => {
    mockStorage.apiUrl = "https://example.com";
    mockStorage.apiKey = "test-key";
    const config = await getConfig();
    expect(config).toEqual({ apiUrl: "https://example.com", apiKey: "test-key" });
  });
});

describe("saveConfig", () => {
  it("saves config to storage", async () => {
    await saveConfig({ apiUrl: "https://example.com", apiKey: "key123" });
    expect(browserMock.storage.sync.set).toHaveBeenCalledWith({
      apiUrl: "https://example.com",
      apiKey: "key123",
    });
  });
});

describe("savePage", () => {
  it("sends correct POST body", async () => {
    configureApi();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "doc-1" }),
    });

    await savePage("https://page.com", "<html></html>", {
      type: "article",
      tagIds: ["tag-1", "tag-2"],
    });

    expect(mockFetch).toHaveBeenCalledWith("https://example.com/api/documents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer key123",
      },
      body: JSON.stringify({
        url: "https://page.com",
        type: "article",
        html: "<html></html>",
        tagIds: ["tag-1", "tag-2"],
      }),
    });
  });

  it("throws when not configured", async () => {
    await expect(savePage("https://page.com", null)).rejects.toThrow(
      "Extension not configured"
    );
  });

  it("throws on error response", async () => {
    configureApi();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: { message: "This URL is already saved" } }),
    });

    await expect(
      savePage("https://page.com", null, { type: "bookmark" })
    ).rejects.toThrow("This URL is already saved");
  });
});

describe("getTags", () => {
  it("sends GET with auth header", async () => {
    configureApi();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: "t1", name: "News", color: "#ff0000" }],
    });

    const tags = await getTags();

    expect(mockFetch).toHaveBeenCalledWith("https://example.com/api/tags", {
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer key123",
      },
    });
    expect(tags).toEqual([{ id: "t1", name: "News", color: "#ff0000" }]);
  });
});

describe("testConnection", () => {
  it("returns true when getTags succeeds", async () => {
    configureApi();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    expect(await testConnection()).toBe(true);
  });

  it("returns false when not configured", async () => {
    expect(await testConnection()).toBe(false);
  });

  it("returns false on network error", async () => {
    configureApi();
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    expect(await testConnection()).toBe(false);
  });
});

describe("lookupByUrl", () => {
  it("sends GET with encoded url parameter", async () => {
    configureApi();
    const doc = { id: "doc-1", title: "Test", tags: [] };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => doc,
    });

    const result = await lookupByUrl("https://page.com/test?q=1");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.com/api/documents/lookup?url=https%3A%2F%2Fpage.com%2Ftest%3Fq%3D1",
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer key123",
        },
      }
    );
    expect(result).toEqual(doc);
  });

  it("returns null when document not found", async () => {
    configureApi();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: { message: "Document not found" } }),
    });

    const result = await lookupByUrl("https://page.com/missing");
    expect(result).toBeNull();
  });

  it("throws on non-404 errors", async () => {
    configureApi();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: "Internal server error" } }),
    });

    await expect(lookupByUrl("https://page.com")).rejects.toThrow(
      "Internal server error"
    );
  });
});

describe("updateDocument", () => {
  it("sends PATCH with correct body", async () => {
    configureApi();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await updateDocument("doc-1", { is_starred: 1 });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.com/api/documents/doc-1",
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer key123",
        },
        body: JSON.stringify({ is_starred: 1 }),
      }
    );
  });

  it("throws when not configured", async () => {
    await expect(updateDocument("doc-1", {})).rejects.toThrow(
      "Extension not configured"
    );
  });
});

describe("deleteDocument", () => {
  it("sends DELETE request", async () => {
    configureApi();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await deleteDocument("doc-1");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.com/api/documents/doc-1",
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer key123",
        },
      }
    );
  });

  it("throws on error response", async () => {
    configureApi();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: { message: "Document not found" } }),
    });

    await expect(deleteDocument("doc-missing")).rejects.toThrow("Document not found");
  });
});

describe("getCollections", () => {
  it("returns collections list", async () => {
    configureApi();
    const collections = [
      { id: "c1", name: "Reading List", description: null },
      { id: "c2", name: "Research", description: "Papers" },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => collections,
    });

    const result = await getCollections();

    expect(mockFetch).toHaveBeenCalledWith("https://example.com/api/collections", {
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer key123",
      },
    });
    expect(result).toEqual(collections);
  });
});

describe("addToCollection", () => {
  it("sends POST with documentId", async () => {
    configureApi();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await addToCollection("c1", "doc-1");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.com/api/collections/c1/documents",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer key123",
        },
        body: JSON.stringify({ documentId: "doc-1" }),
      }
    );
  });

  it("throws when not configured", async () => {
    await expect(addToCollection("c1", "doc-1")).rejects.toThrow(
      "Extension not configured"
    );
  });
});
