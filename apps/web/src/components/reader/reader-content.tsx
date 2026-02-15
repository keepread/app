"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useDocument, useDocumentContent } from "@/hooks/use-documents";
import { useHighlightsForDocument } from "@/hooks/use-highlights";
import { useApp } from "@/contexts/app-context";
import { apiFetch } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { extractDomain } from "@focus-reader/shared";
import type { HighlightWithTags } from "@focus-reader/shared";
import { Skeleton } from "@/components/ui/skeleton";
import { PdfViewer } from "./pdf-viewer";
import { HighlightPopover } from "./highlight-popover";
import { HighlightRenderer } from "./highlight-renderer";
import { HighlightDetailPopover } from "./highlight-detail-popover";
import { usePreferences } from "@/hooks/use-preferences";

interface ReaderContentProps {
  documentId: string;
}

export function ReaderContent({ documentId }: ReaderContentProps) {
  const { document: doc, mutate } = useDocument(documentId);
  const { htmlContent, markdownContent, isLoading: contentLoading } =
    useDocumentContent(documentId);
  const { highlights, mutate: mutateHighlights } = useHighlightsForDocument(documentId);
  const { contentMode } = useApp();
  const { fontFamily, fontSize, lineHeight, contentWidth } = usePreferences();
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Highlight detail popover state
  const [activeHighlight, setActiveHighlight] = useState<HighlightWithTags | null>(null);
  const [detailPosition, setDetailPosition] = useState({ top: 0, left: 0 });

  // Auto-mark as read after 1.5s
  useEffect(() => {
    if (!doc || doc.is_read === 1) return;
    const timer = setTimeout(async () => {
      await apiFetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        body: JSON.stringify({ is_read: 1 }),
      });
      mutate();
    }, 1500);
    return () => clearTimeout(timer);
  }, [doc, documentId, mutate]);

  // Track reading progress on scroll
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const progress = Math.min(
      100,
      Math.round((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100)
    );

    if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
    progressTimerRef.current = setTimeout(async () => {
      await apiFetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        body: JSON.stringify({
          reading_progress: progress,
          last_read_at: new Date().toISOString(),
        }),
      });
    }, 1000);
  }, [documentId]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const handleCreateHighlight = useCallback(
    async (text: string, color: string, positionSelector: string | null, positionPercent: number, note?: string) => {
      await apiFetch(`/api/documents/${documentId}/highlights`, {
        method: "POST",
        body: JSON.stringify({
          text,
          color,
          position_selector: positionSelector,
          position_percent: positionPercent,
          note: note || null,
        }),
      });
      mutateHighlights();
    },
    [documentId, mutateHighlights]
  );

  const handleHighlightClick = useCallback(
    (highlightId: string, rect: DOMRect) => {
      const h = highlights.find((hl) => hl.id === highlightId);
      if (!h) return;
      setActiveHighlight(h);
      setDetailPosition({ top: rect.bottom + 8, left: rect.left + rect.width / 2 });
    },
    [highlights]
  );

  const handleUpdateColor = useCallback(
    async (color: string) => {
      if (!activeHighlight) return;
      await apiFetch(`/api/highlights/${activeHighlight.id}`, {
        method: "PATCH",
        body: JSON.stringify({ color }),
      });
      mutateHighlights();
      setActiveHighlight((prev) => (prev ? { ...prev, color } : null));
    },
    [activeHighlight, mutateHighlights]
  );

  const handleUpdateNote = useCallback(
    async (note: string | null) => {
      if (!activeHighlight) return;
      await apiFetch(`/api/highlights/${activeHighlight.id}`, {
        method: "PATCH",
        body: JSON.stringify({ note }),
      });
      mutateHighlights();
      setActiveHighlight((prev) => (prev ? { ...prev, note } : null));
    },
    [activeHighlight, mutateHighlights]
  );

  const handleDeleteHighlight = useCallback(async () => {
    if (!activeHighlight) return;
    await apiFetch(`/api/highlights/${activeHighlight.id}`, { method: "DELETE" });
    setActiveHighlight(null);
    mutateHighlights();
  }, [activeHighlight, mutateHighlights]);

  if (!doc || contentLoading) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[680px] mx-auto px-6 py-8 space-y-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-48 mt-4" />
          <Skeleton className="h-64 w-full mt-8 rounded-lg" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    );
  }

  if (doc.type === "pdf") {
    return <PdfViewer documentId={documentId} />;
  }

  const domain = doc.url ? extractDomain(doc.url) : doc.site_name;
  const content =
    contentMode === "html" ? htmlContent : markdownContent;

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto relative">
      <article
        className="mx-auto px-6 py-8"
        style={{
          maxWidth: `${contentWidth}px`,
          fontFamily,
          fontSize: `${fontSize}px`,
          lineHeight: `${lineHeight}`,
        }}
      >
        {/* Source */}
        {domain && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider mb-3">
            <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">
              {domain.charAt(0).toUpperCase()}
            </span>
            <span>{domain}</span>
          </div>
        )}

        {/* Title */}
        <h1 className="text-2xl font-bold font-serif leading-tight mb-3">
          {doc.title}
        </h1>

        {/* Meta row */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          {doc.author && <span>{doc.author}</span>}
          {doc.reading_time_minutes > 0 && (
            <>
              <span>&middot;</span>
              <span>{doc.reading_time_minutes} mins</span>
            </>
          )}
          {doc.published_at && (
            <>
              <span>&middot;</span>
              <span>{formatDate(doc.published_at)}</span>
            </>
          )}
        </div>

        {/* Content */}
        {content ? (
          contentMode === "html" ? (
            <div
              ref={contentRef}
              className="prose prose-slate max-w-none prose-headings:font-serif prose-headings:font-bold prose-p:leading-relaxed prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg prose-img:mx-auto prose-blockquote:border-l-primary prose-blockquote:not-italic"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          ) : (
            <div ref={contentRef} className="prose prose-slate max-w-none whitespace-pre-wrap">
              {content}
            </div>
          )
        ) : (
          <p className="text-muted-foreground">No content available</p>
        )}
      </article>

      {/* Highlight rendering */}
      <HighlightRenderer
        containerRef={contentRef}
        highlights={highlights}
        onHighlightClick={handleHighlightClick}
      />

      {/* Selection popover for creating highlights */}
      <HighlightPopover
        onCreateHighlight={handleCreateHighlight}
        containerRef={containerRef}
      />

      {/* Detail popover for editing highlights */}
      {activeHighlight && (
        <HighlightDetailPopover
          highlight={activeHighlight}
          position={detailPosition}
          onUpdateColor={handleUpdateColor}
          onUpdateNote={handleUpdateNote}
          onDelete={handleDeleteHighlight}
          onClose={() => setActiveHighlight(null)}
        />
      )}
    </div>
  );
}
