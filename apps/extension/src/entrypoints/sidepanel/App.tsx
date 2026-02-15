import { useState, useEffect, useCallback, useRef } from "react";
import {
  getConfig,
  updateDocument,
  deleteDocument,
  type DocumentDetail,
} from "@/lib/api-client";
import { sendMessage } from "@/lib/messaging";

type Tab = "inbox" | "later" | "starred";

function domainFromUrl(url: string | null): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function App() {
  const [tab, setTab] = useState<Tab>("inbox");
  const [docs, setDocs] = useState<DocumentDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [currentTabUrl, setCurrentTabUrl] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);
  const [apiUrl, setApiUrl] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const fetchDocs = useCallback(
    async (activeTab: Tab, cursor?: string) => {
      const query: {
        location?: string;
        isStarred?: boolean;
        limit: number;
        cursor?: string;
      } = { limit: 20 };

      if (activeTab === "inbox") query.location = "inbox";
      else if (activeTab === "later") query.location = "later";
      else if (activeTab === "starred") query.isStarred = true;

      if (cursor) query.cursor = cursor;

      const result = await sendMessage("getDocuments", query);
      return result;
    },
    []
  );

  const loadTab = useCallback(
    async (activeTab: Tab) => {
      setLoading(true);
      setDocs([]);
      setNextCursor(undefined);
      try {
        const result = await fetchDocs(activeTab);
        setDocs(result.items);
        setNextCursor(result.nextCursor);
      } catch {
        // Network/auth error — leave empty
      } finally {
        setLoading(false);
      }
    },
    [fetchDocs]
  );

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await fetchDocs(tab, nextCursor);
      setDocs((prev) => [...prev, ...result.items]);
      setNextCursor(result.nextCursor);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }, [fetchDocs, tab, nextCursor, loadingMore]);

  // Init: check config + load inbox
  useEffect(() => {
    (async () => {
      const config = await getConfig();
      if (!config) {
        setConfigured(false);
        setLoading(false);
        return;
      }
      setApiUrl(config.apiUrl.replace(/\/$/, ""));
      await loadTab("inbox");
    })();
  }, [loadTab]);

  // Track current tab URL
  useEffect(() => {
    async function updateCurrentUrl() {
      try {
        const [activeTab] = await browser.tabs.query({
          active: true,
          currentWindow: true,
        });
        setCurrentTabUrl(activeTab?.url ?? null);
      } catch {
        // ignore
      }
    }

    updateCurrentUrl();

    const onActivated = () => updateCurrentUrl();
    const onUpdated = (
      _tabId: number,
      changeInfo: { status?: string }
    ) => {
      if (changeInfo.status === "complete") updateCurrentUrl();
    };

    browser.tabs.onActivated.addListener(onActivated);
    browser.tabs.onUpdated.addListener(onUpdated);
    return () => {
      browser.tabs.onActivated.removeListener(onActivated);
      browser.tabs.onUpdated.removeListener(onUpdated);
    };
  }, []);

  // Refresh on visibility change
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible") {
        loadTab(tab);
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [tab, loadTab]);

  // Infinite scroll
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const handler = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
        loadMore();
      }
    };
    el.addEventListener("scroll", handler);
    return () => el.removeEventListener("scroll", handler);
  }, [loadMore]);

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
    loadTab(newTab);
  };

  const handleStar = async (doc: DocumentDetail) => {
    const newVal = doc.is_starred ? 0 : 1;
    try {
      await updateDocument(doc.id, { is_starred: newVal });
      setDocs((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, is_starred: newVal } : d))
      );
    } catch {
      // ignore
    }
  };

  const handleArchive = async (doc: DocumentDetail) => {
    try {
      await updateDocument(doc.id, { location: "archive" });
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    } catch {
      // ignore
    }
  };

  const handleDelete = async (doc: DocumentDetail) => {
    try {
      await deleteDocument(doc.id);
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    } catch {
      // ignore
    }
  };

  const handleOpenDoc = (doc: DocumentDetail) => {
    if (apiUrl) {
      window.open(`${apiUrl}/inbox?doc=${doc.id}`, "_blank");
    }
  };

  if (!configured) {
    return (
      <div className="p-5">
        <h2 className="text-[15px] font-semibold mb-3">Focus Reader</h2>
        <p className="text-sm text-gray-500 mb-4">Extension not configured.</p>
        <button
          className="w-full px-3 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          onClick={() => browser.runtime.openOptionsPage()}
        >
          Open Settings
        </button>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "inbox", label: "Inbox" },
    { key: "later", label: "Later" },
    { key: "starred", label: "Starred" },
  ];

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-2">
        <h1 className="text-[15px] font-semibold mb-3">Focus Reader</h1>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
                tab === t.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => handleTabChange(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Document list */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="space-y-3 mt-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-3 bg-gray-50 rounded-lg">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : docs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center mt-8">
            No documents
          </p>
        ) : (
          <div className="space-y-1 mt-2">
            {docs.map((doc) => {
              const isHighlighted =
                currentTabUrl && doc.url === currentTabUrl;
              return (
                <div
                  key={doc.id}
                  className={`group relative p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer ${
                    isHighlighted ? "border-l-2 border-l-blue-500 bg-blue-50/50" : ""
                  }`}
                  onClick={() => handleOpenDoc(doc)}
                >
                  <p
                    className={`text-sm font-medium leading-snug line-clamp-2 ${
                      doc.is_read ? "text-gray-400" : "text-gray-900"
                    }`}
                  >
                    {doc.is_starred ? (
                      <span className="text-amber-500 mr-1">&#9733;</span>
                    ) : null}
                    {doc.title}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] text-gray-400">
                    <span>{domainFromUrl(doc.url)}</span>
                    <span className="text-gray-300">&middot;</span>
                    <span>{relativeTime(doc.saved_at)}</span>
                  </div>

                  {/* Hover actions */}
                  <div
                    className="hidden group-hover:flex absolute top-2 right-2 gap-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="p-1 text-[11px] rounded hover:bg-gray-200 text-gray-500"
                      title={doc.is_starred ? "Unstar" : "Star"}
                      onClick={() => handleStar(doc)}
                    >
                      {doc.is_starred ? (
                        <span className="text-amber-500">&#9733;</span>
                      ) : (
                        <span>&#9734;</span>
                      )}
                    </button>
                    <button
                      className="p-1 text-[11px] rounded hover:bg-gray-200 text-gray-500"
                      title="Archive"
                      onClick={() => handleArchive(doc)}
                    >
                      &#x2713;
                    </button>
                    <button
                      className="p-1 text-[11px] rounded hover:bg-gray-200 text-red-400 hover:text-red-600"
                      title="Delete"
                      onClick={() => handleDelete(doc)}
                    >
                      &#x2715;
                    </button>
                  </div>
                </div>
              );
            })}
            {loadingMore && (
              <p className="text-xs text-gray-400 text-center py-2">
                Loading...
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
