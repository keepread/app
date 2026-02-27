"use client";

import { useSearchParams } from "next/navigation";
import { NavSidebar } from "./nav-sidebar";
import { RightSidebar } from "./right-sidebar";
import { ReaderContent } from "@/components/reader/reader-content";
import { ReaderToolbar } from "@/components/reader/reader-toolbar";
import { ReaderToc } from "@/components/reader/reader-toc";
import { useApp } from "@/contexts/app-context";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useDocument } from "@/hooks/use-documents";
import { apiFetch } from "@/lib/api-client";
import { useRouter, usePathname } from "next/navigation";
import { useMemo, useCallback, useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { KeyboardShortcutsDialog } from "@/components/dialogs/keyboard-shortcuts-dialog";
import { AddBookmarkDialog } from "@/components/dialogs/add-bookmark-dialog";
import { TagManagerDialog } from "@/components/dialogs/tag-manager-dialog";
import { CommandPalette } from "@/components/dialogs/command-palette";
import { CollectionDialog } from "@/components/dialogs/collection-dialog";
import { useCollections } from "@/hooks/use-collections";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const selectedDocId = searchParams.get("doc");
  const isReadingView = !!selectedDocId;
  const isTagsPage = pathname === "/tags";
  const isFeedsPage = pathname === "/feeds";
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    toggleSidebar,
    rightPanelVisible,
    toggleRightPanel,
    tocVisible,
    toggleToc,
    toggleContentMode,
    focusMode,
    toggleFocusMode,
    setRightPanelVisible,
    setTocVisible,
    documentIds,
    currentDocumentIndex,
    setCurrentDocumentIndex,
    selectedDocumentId,
    setSelectedDocumentId,
    mutateDocumentList,
  } = useApp();
  const isMobile = useIsMobile();

  const activeDocId = selectedDocId || selectedDocumentId;
  const { document: currentDoc, mutate: mutateDoc } = useDocument(activeDocId);

  // Dialog states
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [addBookmarkOpen, setAddBookmarkOpen] = useState(false);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const { mutate: mutateCollections } = useCollections();
  const desktopPanelStateRef = useRef<{ rightPanelVisible: boolean; tocVisible: boolean } | null>(
    null
  );

  useEffect(() => {
    if (isMobile) {
      if (desktopPanelStateRef.current === null) {
        desktopPanelStateRef.current = { rightPanelVisible, tocVisible };
      }
      setSidebarCollapsed(true);
      setRightPanelVisible(false);
      setTocVisible(false);
      return;
    }

    if (desktopPanelStateRef.current) {
      setRightPanelVisible(desktopPanelStateRef.current.rightPanelVisible);
      setTocVisible(desktopPanelStateRef.current.tocVisible);
      desktopPanelStateRef.current = null;
    }
  }, [
    isMobile,
    rightPanelVisible,
    setRightPanelVisible,
    setSidebarCollapsed,
    setTocVisible,
    tocVisible,
  ]);

  useEffect(() => {
    if (isMobile && !isReadingView) {
      setSidebarCollapsed(true);
    }
  }, [isMobile, isReadingView, pathname, setSidebarCollapsed]);

  const patchDoc = useCallback(
    async (updates: Record<string, unknown>) => {
      if (!activeDocId) return;
      await apiFetch(`/api/documents/${activeDocId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      mutateDoc();
      mutateDocumentList();
    },
    [activeDocId, mutateDoc, mutateDocumentList]
  );

  const selectDocByIndex = useCallback(
    (index: number) => {
      if (index < 0 || index >= documentIds.length) return;
      const id = documentIds[index];
      setCurrentDocumentIndex(index);
      setSelectedDocumentId(id);
    },
    [documentIds, setCurrentDocumentIndex, setSelectedDocumentId]
  );

  const openDocByIndex = useCallback(
    (index: number) => {
      if (index < 0 || index >= documentIds.length) return;
      const id = documentIds[index];
      setCurrentDocumentIndex(index);
      setSelectedDocumentId(id);
      const params = new URLSearchParams(searchParams.toString());
      params.set("doc", id);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [documentIds, setCurrentDocumentIndex, setSelectedDocumentId, searchParams, router, pathname]
  );

  const shortcuts = useMemo(
    () => ({
      "[": toggleSidebar,
      "]": toggleRightPanel,
      f: () => {
        if (isReadingView) toggleFocusMode();
      },
      Escape: () => {
        if (isReadingView) {
          const params = new URLSearchParams(searchParams.toString());
          params.delete("doc");
          const qs = params.toString();
          router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
        }
      },
      "Shift+H": toggleContentMode,
      s: () => {
        if (!currentDoc) return;
        const newVal = currentDoc.is_starred === 1 ? 0 : 1;
        patchDoc({ is_starred: newVal });
        toast(newVal ? "Starred" : "Unstarred");
      },
      m: () => {
        if (!currentDoc) return;
        const newVal = currentDoc.is_read === 1 ? 0 : 1;
        patchDoc({ is_read: newVal });
        toast(newVal ? "Marked as read" : "Marked as unread");
      },
      e: () => {
        if (!currentDoc) return;
        patchDoc({ location: "archive" });
        toast("Archived");
      },
      // j/k document navigation (list view only)
      j: () => {
        if (isReadingView) return;
        const nextIdx = Math.min(currentDocumentIndex + 1, documentIds.length - 1);
        selectDocByIndex(nextIdx);
      },
      ArrowDown: () => {
        if (isReadingView) return;
        const nextIdx = Math.min(currentDocumentIndex + 1, documentIds.length - 1);
        selectDocByIndex(nextIdx);
      },
      k: () => {
        if (isReadingView) return;
        const prevIdx = Math.max(currentDocumentIndex - 1, 0);
        selectDocByIndex(prevIdx);
      },
      ArrowUp: () => {
        if (isReadingView) return;
        const prevIdx = Math.max(currentDocumentIndex - 1, 0);
        selectDocByIndex(prevIdx);
      },
      // Enter — open selected document in reading view (or navigate to tag/feed detail on tags/feeds page)
      Enter: () => {
        if (!isReadingView && currentDocumentIndex >= 0 && currentDocumentIndex < documentIds.length) {
          if (isTagsPage) {
            // On tags page, navigate to tag detail page
            const tagId = documentIds[currentDocumentIndex];
            router.push(`/tags/${tagId}`);
          } else if (isFeedsPage) {
            // On feeds page, navigate to feed detail page
            const feedId = documentIds[currentDocumentIndex];
            router.push(`/feeds/${feedId}`);
          } else {
            openDocByIndex(currentDocumentIndex);
          }
        }
      },
      // o — open original URL in new tab
      o: () => {
        if (currentDoc?.url) window.open(currentDoc.url, "_blank");
      },
      // Space — toggle read/unread (same as m)
      Space: () => {
        if (!currentDoc) return;
        const newVal = currentDoc.is_read === 1 ? 0 : 1;
        patchDoc({ is_read: newVal });
        toast(newVal ? "Marked as read" : "Marked as unread");
      },
      // d — delete document
      d: () => {
        if (!activeDocId) return;
        apiFetch(`/api/documents/${activeDocId}`, { method: "DELETE" }).then(() => {
          toast("Document deleted");
          mutateDocumentList();
          const params = new URLSearchParams(searchParams.toString());
          params.delete("doc");
          const qs = params.toString();
          router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
        });
      },
      // l — move to Later
      l: () => {
        if (!currentDoc) return;
        patchDoc({ location: "later" });
        toast("Moved to Later");
      },
      // Shift+E — move to Inbox
      "Shift+E": () => {
        if (!currentDoc) return;
        patchDoc({ location: "inbox" });
        toast("Moved to Inbox");
      },
      // Shift+C — copy URL
      "Shift+C": () => {
        if (currentDoc?.url) {
          navigator.clipboard.writeText(currentDoc.url);
          toast("Copied to clipboard");
        }
      },
      // t — open tag manager
      t: () => {
        if (activeDocId) setTagManagerOpen(true);
      },
      // a — open add bookmark dialog
      a: () => setAddBookmarkOpen(true),
      // h — create yellow highlight from selection
      h: () => {
        if (!isReadingView) return;
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return;
        const text = selection.toString().trim();
        if (!text || !activeDocId) return;
        apiFetch(`/api/documents/${activeDocId}/highlights`, {
          method: "POST",
          body: JSON.stringify({
            text,
            color: "#FFFF00",
          }),
        }).then(() => {
          toast("Highlighted");
          selection.removeAllRanges();
        });
      },
      // / — focus search input
      "/": () => {
        const searchInput = document.querySelector<HTMLInputElement>(
          'input[type="search"], input[placeholder*="earch"]'
        );
        if (searchInput) searchInput.focus();
      },
      // ? — show keyboard shortcuts
      "?": () => setShortcutsOpen(true),
      // Cmd+K / Ctrl+K — command palette
      "Meta+k": () => setCommandPaletteOpen(true),
      "Ctrl+k": () => setCommandPaletteOpen(true),
    }),
    [
      toggleSidebar,
      toggleRightPanel,
      toggleContentMode,
      toggleFocusMode,
      isReadingView,
      searchParams,
      router,
      pathname,
      currentDoc,
      patchDoc,
      documentIds,
      currentDocumentIndex,
      selectDocByIndex,
      openDocByIndex,
      activeDocId,
    ]
  );

  useKeyboardShortcuts(shortcuts);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Library View */}
      {!isReadingView && (
        <>
          {isMobile ? (
            <Sheet open={!sidebarCollapsed} onOpenChange={(open) => setSidebarCollapsed(!open)}>
              <SheetContent side="left" className="p-0 w-[86vw] max-w-[320px]">
                <SheetTitle className="sr-only">Navigation menu</SheetTitle>
                <SheetDescription className="sr-only">
                  Browse sections, subscriptions, and collections.
                </SheetDescription>
                <NavSidebar forceVisible />
              </SheetContent>
            </Sheet>
          ) : (
            <NavSidebar />
          )}
          {children}
        </>
      )}

      {/* Reading View */}
      {isReadingView && (
        <>
          {!focusMode && !isMobile && <ReaderToc documentId={selectedDocId} />}
          <div className="flex flex-1 flex-col min-w-0">
            <ReaderToolbar documentId={selectedDocId} />
            <ReaderContent documentId={selectedDocId} />
          </div>
        </>
      )}

      {/* Right sidebar — hidden in focus mode */}
      {!focusMode && !isMobile && <RightSidebar />}

      {/* Dialogs */}
      <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <AddBookmarkDialog open={addBookmarkOpen} onOpenChange={setAddBookmarkOpen} />
      <TagManagerDialog
        open={tagManagerOpen}
        onOpenChange={setTagManagerOpen}
        documentId={activeDocId ?? undefined}
        documentTagIds={currentDoc?.tags?.map((t) => t.id) ?? []}
        onTagToggle={() => mutateDoc()}
      />
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onAddBookmark={() => setAddBookmarkOpen(true)}
        onCreateCollection={() => setCollectionDialogOpen(true)}
        onShowShortcuts={() => setShortcutsOpen(true)}
      />
      <CollectionDialog
        open={collectionDialogOpen}
        onOpenChange={setCollectionDialogOpen}
        onSaved={() => mutateCollections()}
      />
    </div>
  );
}
