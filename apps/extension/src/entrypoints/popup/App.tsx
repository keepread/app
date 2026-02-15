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

  useEffect(() => {
    (async () => {
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

      try {
        const result = await sendMessage("getPageStatus", { url: tab.url });
        if (result) {
          setDoc(result);
          setStatus("saved");
        } else {
          setStatus("not-saved");
        }
      } catch {
        setStatus("not-saved");
      }
    })();
  }, []);

  const handleToggleTag = useCallback((tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }, []);

  const handleSave = useCallback(
    async (type: "article" | "bookmark") => {
      setStatus("saving");
      setError("");

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
      }

      try {
        await savePage(pageUrl, html, {
          type: html ? type : "bookmark",
          tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
        });
        await sendMessage("invalidatePageStatus", { url: pageUrl });
        // Re-fetch to show saved state
        const result = await sendMessage("getPageStatus", { url: pageUrl });
        if (result) {
          setDoc(result);
          setStatus("saved");
        } else {
          setStatus("not-saved");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
        setStatus("error");
      }
    },
    [pageUrl, selectedTagIds]
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

  // --- Not configured ---
  if (status === "not-configured") {
    return (
      <div className="w-[400px] p-4">
        <h2 className="text-base font-semibold mb-3">Focus Reader</h2>
        <p className="text-sm text-gray-500 mb-3">Extension not configured.</p>
        <button
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50"
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
      <div className="w-[400px] p-4">
        <h2 className="text-base font-semibold mb-3">Focus Reader</h2>
        <div className="space-y-2 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-3 bg-gray-100 rounded w-1/2" />
          <div className="flex gap-2 mt-3">
            <div className="h-8 bg-gray-200 rounded flex-1" />
            <div className="h-8 bg-gray-200 rounded flex-1" />
          </div>
        </div>
      </div>
    );
  }

  // --- Error (standalone) ---
  if (status === "error" && !doc) {
    return (
      <div className="w-[400px] p-4">
        <h2 className="text-base font-semibold mb-3">Focus Reader</h2>
        <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2 mb-3">{error}</p>
        <button
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50"
          onClick={() => {
            setError("");
            setStatus("not-saved");
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  // --- Saved state ---
  if (status === "saved" && doc) {
    return (
      <div className="w-[400px] p-4">
        <h2 className="text-base font-semibold mb-2">Focus Reader</h2>

        {/* Page card */}
        <div className="mb-3 p-2 bg-gray-50 rounded-md">
          <p className="text-sm font-medium truncate" title={pageUrl}>
            {doc.title || pageTitle || pageUrl}
          </p>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
            <span className="capitalize">{doc.type}</span>
            <span>&middot;</span>
            <span className="capitalize">{doc.location}</span>
            {doc.is_read ? (
              <>
                <span>&middot;</span>
                <span>Read</span>
              </>
            ) : null}
            {doc.is_starred ? (
              <>
                <span>&middot;</span>
                <span>Starred</span>
              </>
            ) : null}
          </div>
          {doc.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {doc.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 bg-white rounded border border-gray-200"
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
          <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2 mb-3">{error}</p>
        )}

        {/* Triage actions */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <button
            disabled={actionInProgress}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
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
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
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
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
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
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
            onClick={loadCollections}
          >
            Add to collection
          </button>
        </div>

        {/* Collection picker */}
        {showCollections && (
          <div className="mb-2 max-h-32 overflow-y-auto border border-gray-200 rounded-md">
            {collections.length === 0 ? (
              <p className="text-xs text-gray-500 p-2">No collections</p>
            ) : (
              collections.map((col) => (
                <button
                  key={col.id}
                  disabled={actionInProgress}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50 border-b border-gray-100 last:border-0"
                  onClick={() => handleAddToCollection(col.id)}
                >
                  {col.name}
                </button>
              ))
            )}
          </div>
        )}

        {/* Delete + Open */}
        <div className="flex gap-2">
          {confirmDelete ? (
            <>
              <button
                disabled={actionInProgress}
                className="flex-1 px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-md hover:bg-red-50 disabled:opacity-50"
                onClick={handleDelete}
              >
                Confirm delete
              </button>
              <button
                className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-50"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                disabled={actionInProgress}
                className="flex-1 px-3 py-1.5 text-xs text-red-600 border border-gray-200 rounded-md hover:bg-red-50 disabled:opacity-50"
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </button>
              <button
                className="flex-1 px-3 py-1.5 text-xs text-blue-600 border border-gray-200 rounded-md hover:bg-blue-50"
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
  return (
    <div className="w-[400px] p-4">
      <h2 className="text-base font-semibold mb-2">Focus Reader</h2>

      <p className="text-sm text-gray-500 truncate mb-3" title={pageUrl}>
        {pageTitle || pageUrl}
      </p>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2 mb-3">{error}</p>
      )}

      <div className="flex gap-2 mb-2">
        <button
          disabled={status === "saving"}
          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
          onClick={() => handleSave("article")}
        >
          {status === "saving" ? "Saving..." : "Save as Article"}
        </button>
        <button
          disabled={status === "saving"}
          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
          onClick={() => handleSave("bookmark")}
        >
          Save as Bookmark
        </button>
      </div>

      <button
        className="w-full text-center text-xs text-gray-500 py-1.5 hover:text-gray-700"
        onClick={() => setShowTags(!showTags)}
      >
        {showTags ? "Hide Tags" : "Add Tags"}
      </button>
      {showTags && <TagPicker selectedIds={selectedTagIds} onToggle={handleToggleTag} />}
    </div>
  );
}
