"use client";

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
import { invalidateDocumentLists } from "@/lib/documents-cache";

interface AppState {
  selectedDocumentId: string | null;
  setSelectedDocumentId: (id: string | null) => void;
  hoveredDocumentId: string | null;
  setHoveredDocumentId: (id: string | null) => void;
  documentIds: string[];
  setDocumentIds: (ids: string[]) => void;
  currentDocumentIndex: number;
  setCurrentDocumentIndex: (index: number) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  rightPanelVisible: boolean;
  setRightPanelVisible: (visible: boolean) => void;
  toggleRightPanel: () => void;
  tocVisible: boolean;
  setTocVisible: (visible: boolean) => void;
  toggleToc: () => void;
  contentMode: "html" | "markdown";
  toggleContentMode: () => void;
  focusMode: boolean;
  toggleFocusMode: () => void;
  registerListMutate: (mutate: () => void) => void;
  mutateDocumentList: () => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [hoveredDocumentId, setHoveredDocumentId] = useState<string | null>(null);
  const [documentIds, setDocumentIds] = useState<string[]>([]);
  const [currentDocumentIndex, setCurrentDocumentIndex] = useState(-1);
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  const [rightPanelVisible, setRightPanelVisibleState] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 768 : true
  );
  const [tocVisible, setTocVisibleState] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 768 : true
  );
  const [contentMode, setContentMode] = useState<"html" | "markdown">("html");
  const [focusMode, setFocusMode] = useState(false);

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    setSidebarCollapsedState(collapsed);
  }, []);
  const setRightPanelVisible = useCallback((visible: boolean) => {
    setRightPanelVisibleState(visible);
  }, []);
  const setTocVisible = useCallback((visible: boolean) => {
    setTocVisibleState(visible);
  }, []);
  const toggleSidebar = useCallback(() => setSidebarCollapsedState((v) => !v), []);
  const toggleRightPanel = useCallback(() => setRightPanelVisibleState((v) => !v), []);
  const toggleToc = useCallback(() => setTocVisibleState((v) => !v), []);
  const toggleContentMode = useCallback(
    () => setContentMode((v) => (v === "html" ? "markdown" : "html")),
    []
  );
  const toggleFocusMode = useCallback(() => setFocusMode((v) => !v), []);
  const listMutateRef = useRef<(() => void) | null>(null);
  const registerListMutate = useCallback((mutate: () => void) => {
    listMutateRef.current = mutate;
  }, []);
  const mutateDocumentList = useCallback(() => {
    listMutateRef.current?.();
    void invalidateDocumentLists();
  }, []);

  return (
    <AppContext.Provider
      value={{
        selectedDocumentId,
        setSelectedDocumentId,
        hoveredDocumentId,
        setHoveredDocumentId,
        documentIds,
        setDocumentIds,
        currentDocumentIndex,
        setCurrentDocumentIndex,
        sidebarCollapsed,
        setSidebarCollapsed,
        toggleSidebar,
        rightPanelVisible,
        setRightPanelVisible,
        toggleRightPanel,
        tocVisible,
        setTocVisible,
        toggleToc,
        contentMode,
        toggleContentMode,
        focusMode,
        toggleFocusMode,
        registerListMutate,
        mutateDocumentList,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
