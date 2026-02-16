import {
  savePage,
  lookupByUrl,
  getDocuments,
  updateDocument,
  type DocumentDetail,
} from "@/lib/api-client";
import { sendMessage, onMessage } from "@/lib/messaging";

// --- Badge cache ---

interface CacheEntry {
  doc: DocumentDetail | null;
  timestamp: number;
}

const CACHE_TTL_MS = 60_000;
const NEGATIVE_CACHE_TTL_MS = 10_000;
const pageCache = new Map<string, CacheEntry>();

function normalizeCacheUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url;
  }
}

function getCached(url: string): CacheEntry | null {
  const entry = pageCache.get(normalizeCacheUrl(url));
  if (!entry) return null;
  const ttl = entry.doc ? CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS;
  if (Date.now() - entry.timestamp > ttl) {
    pageCache.delete(normalizeCacheUrl(url));
    return null;
  }
  return entry;
}

function setCache(url: string, doc: DocumentDetail | null): void {
  pageCache.set(normalizeCacheUrl(url), { doc, timestamp: Date.now() });
}

function clearCache(url: string): void {
  pageCache.delete(normalizeCacheUrl(url));
}

function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Request failed";
}

async function notify(title: string, message: string): Promise<void> {
  try {
    await browser.notifications.create({
      type: "basic",
      iconUrl: browser.runtime.getURL("/icon-48.png"),
      title,
      message,
    });
  } catch {
    // Ignore notification API errors
  }
}

// --- Badge ---

async function updateBadge(tabId: number, doc: DocumentDetail | null): Promise<void> {
  if (doc) {
    await browser.action.setBadgeText({ text: "\u2022", tabId });
    await browser.action.setBadgeBackgroundColor({ color: "#3B82F6", tabId });
  } else {
    await browser.action.setBadgeText({ text: "", tabId });
  }
}

async function checkAndUpdateBadge(tabId: number, url: string): Promise<void> {
  if (!url || url.startsWith("chrome://") || url.startsWith("about:")) return;

  const cached = getCached(url);
  if (cached) {
    await updateBadge(tabId, cached.doc);
    return;
  }

  try {
    const doc = await lookupByUrl(url);
    setCache(url, doc);
    await updateBadge(tabId, doc);
  } catch {
    // Not configured or network error — clear badge
    await updateBadge(tabId, null);
  }
}

// --- HTML capture helper ---

async function captureTabHtml(tabId: number): Promise<string | null> {
  try {
    return await sendMessage("captureHtml", undefined, tabId);
  } catch {
    return null;
  }
}

// --- Background entry ---

export default defineBackground(() => {
  async function registerContextMenus(): Promise<void> {
    // Dev reloads can leave stale menu IDs behind, so clear first.
    await browser.contextMenus.removeAll();
    await browser.contextMenus.create({
      id: "save-page",
      title: "Save page to Focus Reader",
      contexts: ["page"],
    });
    await browser.contextMenus.create({
      id: "save-bookmark",
      title: "Save as bookmark",
      contexts: ["page"],
    });
    await browser.contextMenus.create({
      id: "save-link",
      title: "Save link to Focus Reader",
      contexts: ["link"],
    });
    await browser.contextMenus.create({
      id: "open-sidepanel",
      title: "Open Focus Reader sidebar",
      contexts: ["page"],
    });
  }

  // Context menus
  browser.runtime.onInstalled.addListener(() => {
    registerContextMenus().catch((err) => {
      console.error("Failed to register context menus on install:", err);
    });
  });

  browser.runtime.onStartup.addListener(() => {
    registerContextMenus().catch((err) => {
      console.error("Failed to register context menus on startup:", err);
    });
  });

  // Context menu handlers
  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    try {
      if (info.menuItemId === "save-page" && tab?.id && tab.url) {
        if (!isHttpUrl(tab.url)) {
          throw new Error("Only HTTP/HTTPS pages can be saved.");
        }
        const html = await captureTabHtml(tab.id);
        if (!html) {
          throw new Error("Couldn't capture article content. Use 'Save as bookmark'.");
        }
        await savePage(tab.url, html, { type: "article" });
        clearCache(tab.url);
        await checkAndUpdateBadge(tab.id, tab.url);
        await notify("Focus Reader", "Saved page as article.");
      } else if (info.menuItemId === "save-bookmark" && tab?.url) {
        if (!isHttpUrl(tab.url)) {
          throw new Error("Only HTTP/HTTPS pages can be saved.");
        }
        await savePage(tab.url, null, { type: "bookmark" });
        if (tab.id) {
          clearCache(tab.url);
          await checkAndUpdateBadge(tab.id, tab.url);
        }
        await notify("Focus Reader", "Saved page as bookmark.");
      } else if (info.menuItemId === "save-link" && info.linkUrl) {
        if (!isHttpUrl(info.linkUrl)) {
          throw new Error("Only HTTP/HTTPS links can be saved.");
        }
        await savePage(info.linkUrl, null, { type: "article" });
        await notify("Focus Reader", "Saved link to Focus Reader.");
      } else if (info.menuItemId === "open-sidepanel" && tab?.windowId) {
        await (browser as any).sidePanel.open({ windowId: tab.windowId });
      }
    } catch (err) {
      console.error("Context menu action failed:", err);
      await notify("Focus Reader", `Save failed: ${errorMessage(err)}`);
    }
  });

  // Badge: tab navigation
  browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.url) {
      await checkAndUpdateBadge(tabId, tab.url);
    }
  });

  browser.tabs.onActivated.addListener(async (activeInfo) => {
    try {
      const tab = await browser.tabs.get(activeInfo.tabId);
      if (tab.url) {
        await checkAndUpdateBadge(activeInfo.tabId, tab.url);
      }
    } catch {
      // Tab may have been closed
    }
  });

  // Keyboard shortcuts
  browser.commands.onCommand.addListener(async (command) => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) return;

    try {
      if (command === "save-page") {
        if (!isHttpUrl(tab.url)) {
          throw new Error("Only HTTP/HTTPS pages can be saved.");
        }
        const html = await captureTabHtml(tab.id);
        if (!html) {
          throw new Error("Couldn't capture article content. Use bookmark shortcut.");
        }
        await savePage(tab.url, html, { type: "article" });
        clearCache(tab.url);
        await checkAndUpdateBadge(tab.id, tab.url);
        await notify("Focus Reader", "Saved page as article.");
      } else if (command === "save-bookmark") {
        if (!isHttpUrl(tab.url)) {
          throw new Error("Only HTTP/HTTPS pages can be saved.");
        }
        await savePage(tab.url, null, { type: "bookmark" });
        clearCache(tab.url);
        await checkAndUpdateBadge(tab.id, tab.url);
        await notify("Focus Reader", "Saved page as bookmark.");
      }
    } catch (err) {
      console.error("Keyboard shortcut action failed:", err);
      await notify("Focus Reader", `Save failed: ${errorMessage(err)}`);
    }
  });

  // Message handlers (from popup)
  onMessage("getPageStatus", async (message) => {
    const { url, force } = message.data;
    if (!force) {
      const cached = getCached(url);
      if (cached) return cached.doc;
    }

    const doc = await lookupByUrl(url);
    setCache(url, doc);
    return doc;
  });

  onMessage("invalidatePageStatus", async (message) => {
    const { url } = message.data;
    clearCache(url);

    // Re-check badge on the active tab
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id && tab.url === url) {
      await checkAndUpdateBadge(tab.id, url);
    }
  });

  onMessage("updateDocument", async (message) => {
    await updateDocument(message.data.id, message.data.patch);
  });

  onMessage("getDocuments", async (message) => {
    return await getDocuments(message.data);
  });
});
