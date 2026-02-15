"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface AppState {
  selectedDocumentId: string | null;
  setSelectedDocumentId: (id: string | null) => void;
  documentIds: string[];
  setDocumentIds: (ids: string[]) => void;
  currentDocumentIndex: number;
  setCurrentDocumentIndex: (index: number) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  rightPanelVisible: boolean;
  toggleRightPanel: () => void;
  tocVisible: boolean;
  toggleToc: () => void;
  contentMode: "html" | "markdown";
  toggleContentMode: () => void;
  focusMode: boolean;
  toggleFocusMode: () => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [documentIds, setDocumentIds] = useState<string[]>([]);
  const [currentDocumentIndex, setCurrentDocumentIndex] = useState(-1);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rightPanelVisible, setRightPanelVisible] = useState(true);
  const [tocVisible, setTocVisible] = useState(true);
  const [contentMode, setContentMode] = useState<"html" | "markdown">("html");
  const [focusMode, setFocusMode] = useState(false);

  const toggleSidebar = useCallback(() => setSidebarCollapsed((v) => !v), []);
  const toggleRightPanel = useCallback(() => setRightPanelVisible((v) => !v), []);
  const toggleToc = useCallback(() => setTocVisible((v) => !v), []);
  const toggleContentMode = useCallback(
    () => setContentMode((v) => (v === "html" ? "markdown" : "html")),
    []
  );
  const toggleFocusMode = useCallback(() => setFocusMode((v) => !v), []);

  return (
    <AppContext.Provider
      value={{
        selectedDocumentId,
        setSelectedDocumentId,
        documentIds,
        setDocumentIds,
        currentDocumentIndex,
        setCurrentDocumentIndex,
        sidebarCollapsed,
        toggleSidebar,
        rightPanelVisible,
        toggleRightPanel,
        tocVisible,
        toggleToc,
        contentMode,
        toggleContentMode,
        focusMode,
        toggleFocusMode,
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
