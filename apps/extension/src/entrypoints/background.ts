import { savePage, lookupByUrl, getDocuments, type DocumentDetail } from "@/lib/api-client";
import { sendMessage, onMessage } from "@/lib/messaging";

// --- Badge cache ---

interface CacheEntry {
  doc: DocumentDetail | null;
  timestamp: number;
}

const CACHE_TTL_MS = 60_000;
const pageCache = new Map<string, CacheEntry>();

function getCached(url: string): CacheEntry | null {
  const entry = pageCache.get(url);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    pageCache.delete(url);
    return null;
  }
  return entry;
}

function setCache(url: string, doc: DocumentDetail | null): void {
  pageCache.set(url, { doc, timestamp: Date.now() });
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
  // Context menus
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: "save-page",
      title: "Save page to Focus Reader",
      contexts: ["page"],
    });
    browser.contextMenus.create({
      id: "save-bookmark",
      title: "Save as bookmark",
      contexts: ["page"],
    });
    browser.contextMenus.create({
      id: "save-link",
      title: "Save link to Focus Reader",
      contexts: ["link"],
    });
    browser.contextMenus.create({
      id: "open-sidepanel",
      title: "Open Focus Reader sidebar",
      contexts: ["page"],
    });
  });

  // Context menu handlers
  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    try {
      if (info.menuItemId === "save-page" && tab?.id && tab.url) {
        const html = await captureTabHtml(tab.id);
        await savePage(tab.url, html, { type: html ? "article" : "bookmark" });
        pageCache.delete(tab.url);
        await checkAndUpdateBadge(tab.id, tab.url);
      } else if (info.menuItemId === "save-bookmark" && tab?.url) {
        await savePage(tab.url, null, { type: "bookmark" });
        if (tab.id) {
          pageCache.delete(tab.url);
          await checkAndUpdateBadge(tab.id, tab.url);
        }
      } else if (info.menuItemId === "save-link" && info.linkUrl) {
        await savePage(info.linkUrl, null, { type: "article" });
      } else if (info.menuItemId === "open-sidepanel" && tab?.windowId) {
        await (browser as any).sidePanel.open({ windowId: tab.windowId });
      }
    } catch (err) {
      console.error("Context menu action failed:", err);
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
        const html = await captureTabHtml(tab.id);
        await savePage(tab.url, html, { type: html ? "article" : "bookmark" });
        pageCache.delete(tab.url);
        await checkAndUpdateBadge(tab.id, tab.url);
      } else if (command === "save-bookmark") {
        await savePage(tab.url, null, { type: "bookmark" });
        pageCache.delete(tab.url);
        await checkAndUpdateBadge(tab.id, tab.url);
      }
    } catch (err) {
      console.error("Keyboard shortcut action failed:", err);
    }
  });

  // Message handlers (from popup)
  onMessage("getPageStatus", async (message) => {
    const { url } = message.data;
    const cached = getCached(url);
    if (cached) return cached.doc;

    try {
      const doc = await lookupByUrl(url);
      setCache(url, doc);
      return doc;
    } catch {
      return null;
    }
  });

  onMessage("invalidatePageStatus", async (message) => {
    const { url } = message.data;
    pageCache.delete(url);

    // Re-check badge on the active tab
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id && tab.url === url) {
      await checkAndUpdateBadge(tab.id, url);
    }
  });

  onMessage("getDocuments", async (message) => {
    return await getDocuments(message.data);
  });
});
