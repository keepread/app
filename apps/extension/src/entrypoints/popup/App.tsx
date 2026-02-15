import { useState, useEffect, useCallback } from "react";
import {
  getConfig,
  savePage,
  updateDocument,
  deleteDocument,
  getCollections,
  addToCollection,
  type DocumentDetail,
  type Collection,
} from "@/lib/api-client";
import { sendMessage } from "@/lib/messaging";
import { TagPicker } from "@/components/TagPicker";

type Status =
  | "not-configured"
  | "loading"
  | "not-saved"
  | "saved"
  | "saving"
  | "error";

function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function App() {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [pageTitle, setPageTitle] = useState("");
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showTags, setShowTags] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [showCollections, setShowCollections] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [captureFailed, setCaptureFailed] = useState(false);

  const loadPageState = useCallback(async () => {
    setStatus("loading");
    setError("");
    setCaptureFailed(false);
    try {
      const config = await getConfig();
      if (!config) {
        setStatus("not-configured");
        return;
      }

      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab?.url) setPageUrl(tab.url);
      if (tab?.title) setPageTitle(tab.title);

      if (!tab?.url) {
        setStatus("not-saved");
        return;
      }

      if (!isHttpUrl(tab.url)) {
        setError("Only HTTP/HTTPS pages can be saved.");
        setStatus("not-saved");
        return;
      }

      try {
        const result = await sendMessage("getPageStatus", { url: tab.url });
        if (result) {
          setDoc(result);
          setStatus("saved");
        } else {
          setStatus("not-saved");
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to check if this page is already saved."
        );
        setStatus("error");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load page state.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    loadPageState().catch(() => {
      setError("Failed to load page state.");
      setStatus("error");
    });
  }, [loadPageState]);

  const handleToggleTag = useCallback((tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }, []);

  const handleSave = useCallback(
    async (type: "article" | "bookmark") => {
      if (!isHttpUrl(pageUrl)) {
        setError("Only HTTP/HTTPS pages can be saved.");
        setStatus("not-saved");
        return;
      }

      setStatus("saving");
      setError("");
      setCaptureFailed(false);

      let html: string | null = null;
      if (type === "article") {
        try {
          const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
          if (tab?.id) {
            html = await sendMessage("captureHtml", undefined, tab.id);
          }
        } catch {
          // Content script unavailable
        }

        if (!html) {
          setError(
            "Couldn't capture full article content for this page. Save as bookmark instead."
          );
          setCaptureFailed(true);
          setStatus("not-saved");
          return;
        }
      }

      try {
        const saved = await savePage(pageUrl, html, {
          type,
          tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
        });
        // Invalidate cache so badge updates
        sendMessage("invalidatePageStatus", { url: pageUrl }).catch(() => {});
        // Try to fetch full detail; fall back to save response
        try {
          const result = await sendMessage("getPageStatus", { url: pageUrl });
          if (result) {
            setDoc(result);
            setStatus("saved");
            return;
          }
        } catch {
          // Lookup failed — use save response as fallback
        }
        // Fallback: use the response from savePage
        const fallback = saved as DocumentDetail;
        if (fallback?.id) {
          setDoc({ ...fallback, tags: fallback.tags ?? [] });
          setStatus("saved");
        } else {
          setStatus("saved");
          setDoc({
            id: "",
            type: type,
            url: pageUrl,
            title: pageTitle || pageUrl,
            author: null,
            excerpt: null,
            site_name: null,
            cover_image_url: null,
            location: "inbox",
            is_read: 0,
            is_starred: 0,
            reading_progress: 0,
            saved_at: new Date().toISOString(),
            tags: [],
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
        setStatus("error");
      }
    },
    [pageTitle, pageUrl, selectedTagIds]
  );

  const handleAction = useCallback(
    async (action: () => Promise<void>) => {
      setActionInProgress(true);
      try {
        await action();
        await sendMessage("invalidatePageStatus", { url: pageUrl });
        const result = await sendMessage("getPageStatus", { url: pageUrl });
        if (result) {
          setDoc(result);
          setStatus("saved");
        } else {
          setDoc(null);
          setStatus("not-saved");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed");
      } finally {
        setActionInProgress(false);
      }
    },
    [pageUrl]
  );

  const handleDelete = useCallback(async () => {
    if (!doc) return;
    setActionInProgress(true);
    try {
      await deleteDocument(doc.id);
      await sendMessage("invalidatePageStatus", { url: pageUrl });
      setDoc(null);
      setStatus("not-saved");
      setConfirmDelete(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setActionInProgress(false);
    }
  }, [doc, pageUrl]);

  const handleAddToCollection = useCallback(
    async (collectionId: string) => {
      if (!doc) return;
      await handleAction(async () => {
        await addToCollection(collectionId, doc.id);
      });
      setShowCollections(false);
    },
    [doc, handleAction]
  );

  const loadCollections = useCallback(async () => {
    if (collections.length > 0) {
      setShowCollections(!showCollections);
      return;
    }
    try {
      const result = await getCollections();
      setCollections(result);
      setShowCollections(true);
    } catch {
      setError("Failed to load collections");
    }
  }, [collections, showCollections]);

  const btn =
    "px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40";
  const btnDefault = `${btn} border-gray-200 bg-white hover:bg-gray-50 active:bg-gray-100`;
  const btnPrimary =
    "flex-1 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-40";

  // --- Not configured ---
  if (status === "not-configured") {
    return (
      <div className="w-[400px] p-5">
        <h2 className="text-[15px] font-semibold mb-3">Focus Reader</h2>
        <p className="text-sm text-gray-500 mb-4">Extension not configured.</p>
        <button
          className="w-full px-3 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800"
          onClick={() => browser.runtime.openOptionsPage()}
        >
          Open Settings
        </button>
      </div>
    );
  }

  // --- Loading ---
  if (status === "loading") {
    return (
      <div className="w-[400px] p-5">
        <h2 className="text-[15px] font-semibold mb-4">Focus Reader</h2>
        <div className="space-y-2.5 animate-pulse">
          <div className="h-4 bg-gray-100 rounded-md w-3/4" />
          <div className="h-3 bg-gray-100 rounded-md w-1/2" />
          <div className="flex gap-2 mt-4">
            <div className="h-10 bg-gray-100 rounded-lg flex-1" />
            <div className="h-10 bg-gray-100 rounded-lg flex-1" />
          </div>
        </div>
      </div>
    );
  }

  // --- Error (standalone) ---
  if (status === "error" && !doc) {
    return (
      <div className="w-[400px] p-5">
        <h2 className="text-[15px] font-semibold mb-3">Focus Reader</h2>
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2.5 mb-3">{error}</p>
        <button
          className="w-full px-3 py-2.5 text-sm font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
          onClick={() => loadPageState()}
        >
          Retry
        </button>
      </div>
    );
  }

  // --- Saved state ---
  if (status === "saved" && doc) {
    return (
      <div className="w-[400px] p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-semibold">Focus Reader</h2>
          <span className="text-[10px] font-medium uppercase tracking-wide text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
            Saved
          </span>
        </div>

        {/* Page card */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
          <p className="text-sm font-medium leading-snug line-clamp-2" title={pageUrl}>
            {doc.title || pageTitle || pageUrl}
          </p>
          <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-gray-500">
            <span className="capitalize">{doc.type}</span>
            <span className="text-gray-300">/</span>
            <span className="capitalize">{doc.location}</span>
            {doc.is_read ? (
              <>
                <span className="text-gray-300">/</span>
                <span>Read</span>
              </>
            ) : null}
            {doc.is_starred ? (
              <>
                <span className="text-gray-300">/</span>
                <span className="text-amber-600">Starred</span>
              </>
            ) : null}
          </div>
          {doc.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {doc.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 bg-white rounded-md border border-gray-200"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color ?? "#888" }}
                  />
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>
        )}

        {/* Triage actions */}
        <div className="grid grid-cols-2 gap-1.5 mb-3">
          <button
            disabled={actionInProgress}
            className={btnDefault}
            onClick={() =>
              handleAction(() =>
                updateDocument(doc.id, { is_starred: doc.is_starred ? 0 : 1 })
              )
            }
          >
            {doc.is_starred ? "Unstar" : "Star"}
          </button>
          <button
            disabled={actionInProgress}
            className={btnDefault}
            onClick={() =>
              handleAction(() =>
                updateDocument(doc.id, { is_read: doc.is_read ? 0 : 1 })
              )
            }
          >
            {doc.is_read ? "Mark unread" : "Mark read"}
          </button>
          <button
            disabled={actionInProgress}
            className={btnDefault}
            onClick={() =>
              handleAction(() =>
                updateDocument(doc.id, { location: "archive" })
              )
            }
          >
            Archive
          </button>
          <button
            disabled={actionInProgress}
            className={btnDefault}
            onClick={loadCollections}
          >
            Add to collection
          </button>
        </div>

        {/* Collection picker */}
        {showCollections && (
          <div className="mb-3 max-h-32 overflow-y-auto border border-gray-200 rounded-lg">
            {collections.length === 0 ? (
              <p className="text-xs text-gray-400 p-3">No collections</p>
            ) : (
              collections.map((col) => (
                <button
                  key={col.id}
                  disabled={actionInProgress}
                  className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-gray-50 disabled:opacity-40 border-b border-gray-100 last:border-0"
                  onClick={() => handleAddToCollection(col.id)}
                >
                  {col.name}
                </button>
              ))
            )}
          </div>
        )}

        {/* Delete + Open */}
        <div className="flex gap-2 pt-2 border-t border-gray-100">
          {confirmDelete ? (
            <>
              <button
                disabled={actionInProgress}
                className="flex-1 px-3 py-2 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-40"
                onClick={handleDelete}
              >
                Confirm delete
              </button>
              <button
                className="flex-1 px-3 py-2 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                disabled={actionInProgress}
                className="flex-1 px-3 py-2 text-xs font-medium text-red-600 border border-gray-200 rounded-lg hover:bg-red-50 disabled:opacity-40"
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </button>
              <button
                className="flex-1 px-3 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                onClick={async () => {
                  const config = await getConfig();
                  if (config) {
                    window.open(
                      `${config.apiUrl.replace(/\/$/, "")}/inbox?doc=${doc.id}`,
                      "_blank"
                    );
                  }
                }}
              >
                Open in Reader
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // --- Not saved / saving ---
  const canSavePage = isHttpUrl(pageUrl);

  return (
    <div className="w-[400px] p-5">
      <h2 className="text-[15px] font-semibold mb-1">Focus Reader</h2>

      <p className="text-sm text-gray-500 truncate mb-4" title={pageUrl}>
        {pageTitle || pageUrl}
      </p>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2.5 mb-3">{error}</p>
      )}

      {captureFailed && canSavePage && status !== "saving" && (
        <button
          className="w-full mb-3 px-3 py-2 text-xs font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
          onClick={() => handleSave("bookmark")}
        >
          Save as Bookmark Instead
        </button>
      )}

      <div className="flex gap-2 mb-3">
        <button
          disabled={status === "saving" || !canSavePage}
          className={`${btnPrimary} bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800`}
          onClick={() => handleSave("article")}
        >
          {status === "saving" ? "Saving..." : "Save as Article"}
        </button>
        <button
          disabled={status === "saving" || !canSavePage}
          className={`${btnPrimary} bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 active:bg-gray-100`}
          onClick={() => handleSave("bookmark")}
        >
          Save as Bookmark
        </button>
      </div>

      <button
        className="w-full text-center text-xs text-gray-400 py-1 hover:text-gray-600 transition-colors"
        onClick={() => setShowTags(!showTags)}
      >
        {showTags ? "Hide Tags" : "Add Tags"}
      </button>
      {showTags && <TagPicker selectedIds={selectedTagIds} onToggle={handleToggleTag} />}
    </div>
  );
}
