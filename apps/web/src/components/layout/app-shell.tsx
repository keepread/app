"use client";

import { useSearchParams } from "next/navigation";
import { NavSidebar } from "./nav-sidebar";
import { RightSidebar } from "./right-sidebar";
import { ReaderContent } from "@/components/reader/reader-content";
import { ReaderToolbar } from "@/components/reader/reader-toolbar";
import { ReaderToc } from "@/components/reader/reader-toc";
import { useApp } from "@/contexts/app-context";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useRouter, usePathname } from "next/navigation";
import { useMemo } from "react";

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
  } = useApp();

  const shortcuts = useMemo(
    () => ({
      "[": toggleSidebar,
      "]": toggleRightPanel,
      Escape: () => {
        if (isReadingView) {
          const params = new URLSearchParams(searchParams.toString());
          params.delete("doc");
          const qs = params.toString();
          router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
        }
      },
      "Shift+H": toggleContentMode,
    }),
    [
      toggleSidebar,
      toggleRightPanel,
      toggleContentMode,
      isReadingView,
      searchParams,
      router,
      pathname,
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
          <ReaderToc documentId={selectedDocId} />
          <div className="flex flex-1 flex-col min-w-0">
            <ReaderToolbar documentId={selectedDocId} />
            <ReaderContent documentId={selectedDocId} />
          </div>
        </>
      )}

      {/* Persistent right sidebar */}
      <RightSidebar />
    </div>
  );
}
