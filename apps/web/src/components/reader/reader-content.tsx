"use client";

import { useEffect, useRef, useCallback } from "react";
import { useDocument, useDocumentContent } from "@/hooks/use-documents";
import { useApp } from "@/contexts/app-context";
import { apiFetch } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { extractDomain } from "@focus-reader/shared";
import { Skeleton } from "@/components/ui/skeleton";

interface ReaderContentProps {
  documentId: string;
}

export function ReaderContent({ documentId }: ReaderContentProps) {
  const { document: doc, mutate } = useDocument(documentId);
  const { htmlContent, markdownContent, isLoading: contentLoading } =
    useDocumentContent(documentId);
  const { contentMode } = useApp();
  const containerRef = useRef<HTMLDivElement>(null);
  const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const domain = doc.url ? extractDomain(doc.url) : doc.site_name;
  const content =
    contentMode === "html" ? htmlContent : markdownContent;

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto">
      <article className="max-w-[680px] mx-auto px-6 py-8">
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
              className="prose prose-slate max-w-none prose-headings:font-serif prose-headings:font-bold prose-p:leading-relaxed prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg prose-img:mx-auto prose-blockquote:border-l-primary prose-blockquote:not-italic"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          ) : (
            <div className="prose prose-slate max-w-none whitespace-pre-wrap">
              {content}
            </div>
          )
        ) : (
          <p className="text-muted-foreground">No content available</p>
        )}
      </article>
    </div>
  );
}
