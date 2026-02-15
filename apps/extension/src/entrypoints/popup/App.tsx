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

type PopupTab = "page" | "saved";
type PopupTheme = "light" | "dark" | "system";
type DefaultSaveType = "article" | "bookmark";

function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function relativeTime(iso?: string): string {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function resolveTheme(theme: PopupTheme, prefersDark: boolean): "light" | "dark" {
  if (theme === "system") return prefersDark ? "dark" : "light";
  return theme;
}

export function App() {
  const [status, setStatus] = useState<Status>("loading");
  const [activeTab, setActiveTab] = useState<PopupTab>("page");
  const [error, setError] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [pageTitle, setPageTitle] = useState("");
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showTags, setShowTags] = useState(false);
  const [showPageSavedTagEditor, setShowPageSavedTagEditor] = useState(false);
  const [showSavedTagEditor, setShowSavedTagEditor] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [showCollections, setShowCollections] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [captureFailed, setCaptureFailed] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState<PopupTheme>("system");
  const [defaultSaveType, setDefaultSaveType] = useState<DefaultSaveType>("article");
  const [settingsApiUrl, setSettingsApiUrl] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await browser.storage.sync.get(["theme", "defaultSaveType", "apiUrl"]);
      const storedTheme = stored.theme;
      const storedSaveType = stored.defaultSaveType;
      if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system") {
        setTheme(storedTheme);
      }
      if (storedSaveType === "article" || storedSaveType === "bookmark") {
        setDefaultSaveType(storedSaveType);
      }
      if (typeof stored.apiUrl === "string") {
        setSettingsApiUrl(stored.apiUrl);
      }
    })();
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme = resolveTheme(theme, media.matches);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  const loadPageState = useCallback(async () => {
    setStatus("loading");
    setError("");
    setCaptureFailed(false);
    setConfirmDelete(false);
    setShowPageSavedTagEditor(false);
    setShowSavedTagEditor(false);
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
        setDoc(null);
        setStatus("not-saved");
        return;
      }

      if (!isHttpUrl(tab.url)) {
        setDoc(null);
        setError("Only HTTP/HTTPS pages can be saved.");
        setStatus("not-saved");
        return;
      }

      const result = await sendMessage("getPageStatus", { url: tab.url, force: true });
      if (result) {
        setDoc(result);
        setStatus("saved");
      } else {
        setDoc(null);
        setStatus("not-saved");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to check if this page is already saved."
      );
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
          if (tab?.id) html = await sendMessage("captureHtml", undefined, tab.id);
        } catch {
          // Content script unavailable
        }

        if (!html) {
          setError("Couldn't capture full article content for this page. Save as bookmark instead.");
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

        sendMessage("invalidatePageStatus", { url: pageUrl }).catch(() => {});

        try {
          const result = await sendMessage("getPageStatus", { url: pageUrl, force: true });
          if (result) {
            setDoc(result);
            setActiveTab("saved");
            setStatus("saved");
            return;
          }
        } catch {
          // Fall through to response fallback
        }

        const fallback = saved as DocumentDetail;
        if (fallback?.id) {
          setDoc({ ...fallback, tags: fallback.tags ?? [] });
          setActiveTab("saved");
          setStatus("saved");
        } else {
          setDoc({
            id: "",
            type,
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
          setActiveTab("saved");
          setStatus("saved");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Save failed";
        if (message.includes("already saved")) {
          try {
            await sendMessage("invalidatePageStatus", { url: pageUrl });
            const existing = await sendMessage("getPageStatus", { url: pageUrl, force: true });
            if (existing) {
              setDoc(existing);
              setActiveTab("saved");
              setError("");
              setStatus("saved");
              return;
            }
          } catch {
            // fall through to default error handling
          }
        }
        setError(message);
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
        const result = await sendMessage("getPageStatus", { url: pageUrl, force: true });
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
    if (!doc?.id) return;
    setActionInProgress(true);
    try {
      await deleteDocument(doc.id);
      await sendMessage("invalidatePageStatus", { url: pageUrl });
      setDoc(null);
      setStatus("not-saved");
      setConfirmDelete(false);
      setShowPageSavedTagEditor(false);
      setShowSavedTagEditor(false);
      setActiveTab("page");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setActionInProgress(false);
    }
  }, [doc, pageUrl]);

  const handleAddToCollection = useCallback(
    async (collectionId: string) => {
      if (!doc?.id) return;
      await handleAction(async () => {
        await addToCollection(collectionId, doc.id);
      });
      setShowCollections(false);
    },
    [doc, handleAction]
  );

  const loadCollections = useCallback(async () => {
    if (collections.length > 0) {
      setShowCollections((prev) => !prev);
      return;
    }
    try {
      const result = await getCollections();
      setCollections(result);
      setShowCollections(true);
    } catch {
      setError("Failed to load collections.");
    }
  }, [collections.length]);

  const handleToggleSavedTag = useCallback(
    async (tagId: string) => {
      if (!doc?.id) return;
      const hasTag = doc.tags.some((tag) => tag.id === tagId);
      await handleAction(async () => {
        await updateDocument(
          doc.id,
          hasTag ? { removeTagId: tagId } : { addTagId: tagId }
        );
      });
    },
    [doc, handleAction]
  );

  const saveQuickSettings = useCallback(async () => {
    setSavingSettings(true);
    try {
      const cleanApiUrl = settingsApiUrl.trim().replace(/\/$/, "");
      await browser.storage.sync.set({
        theme,
        defaultSaveType,
        apiUrl: cleanApiUrl,
      });
      setShowSettings(false);
      await loadPageState();
    } finally {
      setSavingSettings(false);
    }
  }, [defaultSaveType, loadPageState, settingsApiUrl, theme]);

  const openDocumentInReader = useCallback(async (document: DocumentDetail) => {
    const config = await getConfig();
    if (!config) return;
    const locationPath =
      document.location === "later"
        ? "later"
        : document.location === "archive"
          ? "archive"
          : "inbox";
    window.open(
      `${config.apiUrl.replace(/\/$/, "")}/${locationPath}?doc=${document.id}`,
      "_blank"
    );
  }, []);

  const canSavePage = isHttpUrl(pageUrl);
  const pageDomain = domainFromUrl(pageUrl);
  const isSaved = status === "saved" && !!doc;

  const primarySaveType = defaultSaveType;
  const secondarySaveType = defaultSaveType === "article" ? "bookmark" : "article";
  const primaryLabel = primarySaveType === "article" ? "Save as Article" : "Save as Bookmark";
  const secondaryLabel =
    secondarySaveType === "article" ? "Save as Article" : "Save as Bookmark";

  return (
    <div className="relative w-[400px] min-h-[520px] bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-tight">Focus Reader</span>
          {isSaved ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
              Saved
            </span>
          ) : null}
        </div>
        <button
          className="text-xs px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)]"
          onClick={() => setShowSettings(true)}
          title="Quick settings"
        >
          Settings
        </button>
      </header>

      <div className="px-4 pt-3">
        <div className="grid grid-cols-2 gap-1 p-1 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)]">
          <button
            className={`text-xs py-1.5 rounded-md transition-colors ${
              activeTab === "page"
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
            onClick={() => setActiveTab("page")}
          >
            Page
          </button>
          <button
            className={`text-xs py-1.5 rounded-md transition-colors ${
              activeTab === "saved"
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
            onClick={() => setActiveTab("saved")}
          >
            Saved
          </button>
        </div>
      </div>

      <div className="p-4">
        <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] mb-3">
          <p className="text-sm font-medium leading-snug line-clamp-2">{pageTitle || pageUrl}</p>
          <div className="mt-1.5 text-[11px] text-[var(--text-tertiary)] flex items-center gap-1.5">
            <span className="truncate">{pageDomain}</span>
            {doc?.saved_at ? (
              <>
                <span>·</span>
                <span>Saved {relativeTime(doc.saved_at)}</span>
              </>
            ) : (
              <>
                <span>·</span>
                <span>Not saved</span>
              </>
            )}
          </div>
        </div>

        {error ? (
          <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-3">
            {error}
          </p>
        ) : null}

        {status === "loading" ? (
          <div className="space-y-2.5 animate-pulse">
            <div className="h-9 bg-[var(--bg-secondary)] rounded-lg" />
            <div className="h-9 bg-[var(--bg-secondary)] rounded-lg" />
            <div className="h-16 bg-[var(--bg-secondary)] rounded-lg" />
          </div>
        ) : activeTab === "page" ? (
          <>
            {status === "not-configured" ? (
              <div className="space-y-2">
                <p className="text-sm text-[var(--text-secondary)]">
                  Extension is not configured. Set API URL and API key first.
                </p>
                <button
                  className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
                  onClick={() => browser.runtime.openOptionsPage()}
                >
                  Open Full Settings
                </button>
              </div>
            ) : isSaved && doc ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3">
                  <p className="text-sm font-medium text-emerald-400">
                    Already saved in {doc.location}.
                  </p>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <button
                      disabled={actionInProgress}
                      className="px-2 py-2 text-xs rounded-lg border border-[var(--border)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
                      onClick={() => openDocumentInReader(doc)}
                    >
                      Open
                    </button>
                    <button
                      disabled={actionInProgress}
                      className="px-2 py-2 text-xs rounded-lg border border-[var(--border)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
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
                      className="px-2 py-2 text-xs rounded-lg border border-[var(--border)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
                      onClick={() =>
                        handleAction(() =>
                          updateDocument(doc.id, {
                            location: doc.location === "archive" ? "inbox" : "archive",
                          })
                        )
                      }
                    >
                      {doc.location === "archive" ? "Unarchive" : "Archive"}
                    </button>
                  </div>
                  <button
                    className="mt-2 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    onClick={() => setActiveTab("saved")}
                  >
                    Open full controls in Saved tab
                  </button>
                </div>

                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-[var(--text-secondary)]">
                      Quick tags
                    </span>
                    <button
                      disabled={actionInProgress}
                      className="text-xs px-2 py-1 rounded-md border border-[var(--border)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
                      onClick={() => setShowPageSavedTagEditor((prev) => !prev)}
                    >
                      {showPageSavedTagEditor ? "Done" : "Edit tags"}
                    </button>
                  </div>

                  {doc.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {doc.tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-[var(--border)]"
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: tag.color ?? "#888" }}
                          />
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--text-tertiary)]">No tags yet.</p>
                  )}

                  {showPageSavedTagEditor ? (
                    <div className="mt-2">
                      <TagPicker
                        selectedIds={doc.tags.map((tag) => tag.id)}
                        onToggle={handleToggleSavedTag}
                        disabled={actionInProgress}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            ) : !canSavePage ? (
              <p className="text-sm text-[var(--text-secondary)]">
                This page cannot be saved. Switch to an HTTP/HTTPS page.
              </p>
            ) : (
              <>
                {captureFailed && status !== "saving" ? (
                  <button
                    className="w-full mb-2 px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)]"
                    onClick={() => handleSave("bookmark")}
                  >
                    Save as Bookmark Instead
                  </button>
                ) : null}
                <div className="space-y-2">
                  <button
                    disabled={status === "saving"}
                    className="w-full px-3 py-2.5 text-sm rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
                    onClick={() => handleSave(primarySaveType)}
                  >
                    {status === "saving" ? "Saving..." : primaryLabel}
                  </button>
                  <button
                    disabled={status === "saving"}
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
                    onClick={() => handleSave(secondarySaveType)}
                  >
                    {secondaryLabel}
                  </button>
                </div>
                <button
                  className="mt-3 w-full text-center text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                  onClick={() => setShowTags((prev) => !prev)}
                >
                  {showTags
                    ? "Hide tags"
                    : `Add tags${selectedTagIds.length > 0 ? ` (${selectedTagIds.length})` : ""}`}
                </button>
                <p className="mt-1 text-[11px] text-[var(--text-tertiary)] text-center">
                  Tags selected here are applied when you save this page.
                </p>
                {showTags ? (
                  <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2">
                    <TagPicker
                      selectedIds={selectedTagIds}
                      onToggle={handleToggleTag}
                      disabled={status === "saving"}
                    />
                  </div>
                ) : null}
              </>
            )}
          </>
        ) : isSaved && doc ? (
          <>
            <div className="mb-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-[var(--text-secondary)]">Tags</span>
                <button
                  disabled={actionInProgress}
                  className="text-xs px-2 py-1 rounded-md border border-[var(--border)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
                  onClick={() => setShowSavedTagEditor((prev) => !prev)}
                >
                  {showSavedTagEditor ? "Done" : "Edit tags"}
                </button>
              </div>

              {doc.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {doc.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-[var(--border)]"
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: tag.color ?? "#888" }}
                      />
                      {tag.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--text-tertiary)]">No tags yet.</p>
              )}

              {showSavedTagEditor ? (
                <div className="mt-2">
                  <TagPicker
                    selectedIds={doc.tags.map((tag) => tag.id)}
                    onToggle={handleToggleSavedTag}
                    disabled={actionInProgress}
                  />
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                disabled={actionInProgress}
                className="px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
                onClick={() =>
                  handleAction(() => updateDocument(doc.id, { is_starred: doc.is_starred ? 0 : 1 }))
                }
              >
                {doc.is_starred ? "Unstar" : "Star"}
              </button>
              <button
                disabled={actionInProgress}
                className="px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
                onClick={() =>
                  handleAction(() => updateDocument(doc.id, { is_read: doc.is_read ? 0 : 1 }))
                }
              >
                {doc.is_read ? "Mark unread" : "Mark read"}
              </button>
              <button
                disabled={actionInProgress}
                className="px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
                onClick={() =>
                  handleAction(() =>
                    updateDocument(doc.id, { location: doc.location === "archive" ? "inbox" : "archive" })
                  )
                }
              >
                {doc.location === "archive" ? "Move to inbox" : "Archive"}
              </button>
              <button
                disabled={actionInProgress}
                className="px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
                onClick={loadCollections}
              >
                Add to collection
              </button>
            </div>

            {showCollections ? (
              <div className="mb-3 max-h-32 overflow-y-auto rounded-lg border border-[var(--border)]">
                {collections.length === 0 ? (
                  <p className="text-xs text-[var(--text-tertiary)] p-3">No collections found.</p>
                ) : (
                  collections.map((col) => (
                    <button
                      key={col.id}
                      disabled={actionInProgress}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-hover)] border-b border-[var(--border)] last:border-0 disabled:opacity-50"
                      onClick={() => handleAddToCollection(col.id)}
                    >
                      {col.name}
                    </button>
                  ))
                )}
              </div>
            ) : null}

            <div className="flex gap-2 pt-2 border-t border-[var(--border)]">
              {confirmDelete ? (
                <>
                  <button
                    disabled={actionInProgress}
                    className="flex-1 px-3 py-2 text-xs rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                    onClick={handleDelete}
                  >
                    Confirm delete
                  </button>
                  <button
                    className="flex-1 px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)]"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    disabled={actionInProgress}
                    className="flex-1 px-3 py-2 text-xs rounded-lg border border-[var(--border)] text-red-300 bg-[var(--bg-card)] hover:bg-red-500/10 disabled:opacity-50"
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete
                  </button>
                  <button
                    className="flex-1 px-3 py-2 text-xs rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
                    onClick={() => openDocumentInReader(doc)}
                  >
                    Open in Reader
                  </button>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm font-medium mb-1">This page is not saved yet</p>
            <p className="text-xs text-[var(--text-tertiary)] mb-3">
              Save it first, then manage it from the Saved tab.
            </p>
            <button
              className="px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)]"
              onClick={() => setActiveTab("page")}
            >
              Go to Page tab
            </button>
          </div>
        )}
      </div>

      {showSettings ? (
        <div className="absolute inset-0 z-20 bg-[var(--bg-primary)] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <h3 className="text-sm font-semibold">Quick Settings</h3>
            <button
              className="text-xs px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)]"
              onClick={() => setShowSettings(false)}
            >
              Close
            </button>
          </div>
          <div className="p-4 space-y-4 flex-1 overflow-y-auto">
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">API URL</label>
              <input
                value={settingsApiUrl}
                onChange={(e) => setSettingsApiUrl(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg-card)] focus:outline-none focus:border-[var(--accent)]"
                placeholder="https://your-focus-reader.example.com"
              />
              <p className="text-[11px] text-[var(--text-tertiary)] mt-1">
                API key stays managed in the full settings page.
              </p>
            </div>

            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Theme</label>
              <div className="grid grid-cols-3 gap-2">
                {(["system", "light", "dark"] as PopupTheme[]).map((item) => (
                  <button
                    key={item}
                    className={`px-2 py-2 text-xs rounded-lg border ${
                      theme === item
                        ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                        : "border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)]"
                    }`}
                    onClick={() => setTheme(item)}
                  >
                    {item.charAt(0).toUpperCase() + item.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">
                Default save button
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(["article", "bookmark"] as DefaultSaveType[]).map((item) => (
                  <button
                    key={item}
                    className={`px-2 py-2 text-xs rounded-lg border ${
                      defaultSaveType === item
                        ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                        : "border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)]"
                    }`}
                    onClick={() => setDefaultSaveType(item)}
                  >
                    {item === "article" ? "Article" : "Bookmark"}
                  </button>
                ))}
              </div>
            </div>

            <button
              className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
              onClick={saveQuickSettings}
              disabled={savingSettings}
            >
              {savingSettings ? "Saving..." : "Save quick settings"}
            </button>

            <button
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)]"
              onClick={() => browser.runtime.openOptionsPage()}
            >
              Open full settings
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
