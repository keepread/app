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
import { useMemo, useCallback, useState } from "react";
import { toast } from "sonner";
import { KeyboardShortcutsDialog } from "@/components/dialogs/keyboard-shortcuts-dialog";
import { AddBookmarkDialog } from "@/components/dialogs/add-bookmark-dialog";
import { TagManagerDialog } from "@/components/dialogs/tag-manager-dialog";
import { CommandPalette } from "@/components/dialogs/command-palette";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const selectedDocId = searchParams.get("doc");
  const isReadingView = !!selectedDocId;
  const {
    sidebarCollapsed,
    toggleSidebar,
    toggleRightPanel,
    toggleToc,
    toggleContentMode,
    focusMode,
    toggleFocusMode,
    documentIds,
    currentDocumentIndex,
    setCurrentDocumentIndex,
    setSelectedDocumentId,
  } = useApp();

  const { document: currentDoc, mutate: mutateDoc } = useDocument(selectedDocId);

  // Dialog states
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [addBookmarkOpen, setAddBookmarkOpen] = useState(false);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const patchDoc = useCallback(
    async (updates: Record<string, unknown>) => {
      if (!selectedDocId) return;
      await apiFetch(`/api/documents/${selectedDocId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      mutateDoc();
    },
    [selectedDocId, mutateDoc]
  );

  const selectDocByIndex = useCallback(
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
      // Enter — open selected document
      Enter: () => {
        if (!isReadingView && currentDocumentIndex >= 0 && currentDocumentIndex < documentIds.length) {
          const id = documentIds[currentDocumentIndex];
          const params = new URLSearchParams(searchParams.toString());
          params.set("doc", id);
          router.push(`${pathname}?${params.toString()}`, { scroll: false });
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
        if (!selectedDocId) return;
        apiFetch(`/api/documents/${selectedDocId}`, { method: "DELETE" }).then(() => {
          toast("Document deleted");
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
        if (selectedDocId) setTagManagerOpen(true);
      },
      // a — open add bookmark dialog
      a: () => setAddBookmarkOpen(true),
      // / — focus search input
      "/": () => {
        const searchInput = document.querySelector<HTMLInputElement>(
          'input[type="search"], input[placeholder*="earch"]'
        );
        if (searchInput) searchInput.focus();
      },
      // ? — show keyboard shortcuts
      "Shift+/": () => setShortcutsOpen(true),
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
      selectedDocId,
    ]
  );

  useKeyboardShortcuts(shortcuts);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Library View */}
      {!isReadingView && (
        <>
          <NavSidebar />
          {children}
        </>
      )}

      {/* Reading View */}
      {isReadingView && (
        <>
          {!focusMode && <ReaderToc documentId={selectedDocId} />}
          <div className="flex flex-1 flex-col min-w-0">
            <ReaderToolbar documentId={selectedDocId} />
            <ReaderContent documentId={selectedDocId} />
          </div>
        </>
      )}

      {/* Right sidebar — hidden in focus mode */}
      {!focusMode && <RightSidebar />}

      {/* Dialogs */}
      <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <AddBookmarkDialog open={addBookmarkOpen} onOpenChange={setAddBookmarkOpen} />
      <TagManagerDialog
        open={tagManagerOpen}
        onOpenChange={setTagManagerOpen}
        documentId={selectedDocId ?? undefined}
        documentTagIds={currentDoc?.tags?.map((t) => t.id) ?? []}
        onTagToggle={() => mutateDoc()}
      />
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onAddBookmark={() => setAddBookmarkOpen(true)}
      />
    </div>
  );
}
