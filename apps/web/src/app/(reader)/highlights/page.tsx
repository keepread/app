"use client";

import { useState } from "react";
import { useHighlights } from "@/hooks/use-highlights";
import { useTags } from "@/hooks/use-tags";
import { useRouter, usePathname } from "next/navigation";
import { HIGHLIGHT_COLORS } from "@focus-reader/shared";
import { Highlighter, PanelLeftOpen, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useApp } from "@/contexts/app-context";
import { timeAgo } from "@/lib/format";
import { useIsMobile } from "@/hooks/use-mobile";

export default function HighlightsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const { sidebarCollapsed, toggleSidebar, rightPanelVisible, toggleRightPanel } = useApp();
  const { tags } = useTags();
  const [colorFilter, setColorFilter] = useState<string | undefined>();
  const [tagFilter, setTagFilter] = useState<string | undefined>();
  const { highlights, total, isLoading } = useHighlights({
    color: colorFilter,
    tagId: tagFilter,
    limit: 50,
  });

  // Group by document
  const grouped = highlights.reduce<
    Record<string, { title: string; docId: string; items: typeof highlights }>
  >((acc, h) => {
    const key = h.document.id;
    if (!acc[key]) {
      acc[key] = { title: h.document.title, docId: h.document.id, items: [] };
    }
    acc[key].items.push(h);
    return acc;
  }, {});

  const navigateToHighlight = (docId: string) => {
    router.push(`${pathname}?doc=${docId}`);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          {sidebarCollapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7" onClick={toggleSidebar}>
                  <PanelLeftOpen className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <span>Show left panel</span>
                <kbd className="ml-2 rounded border bg-muted px-1 py-0.5 text-[10px] font-mono">[</kbd>
              </TooltipContent>
            </Tooltip>
          )}
          <Highlighter className="size-4 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Highlights</h1>
          <span className="text-sm text-muted-foreground">({total})</span>
        </div>
        {!isMobile && !rightPanelVisible && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7" onClick={toggleRightPanel}>
                <PanelRightOpen className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <span>Show right panel</span>
              <kbd className="ml-2 rounded border bg-muted px-1 py-0.5 text-[10px] font-mono">]</kbd>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-b">
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Color:</span>
          <button
            className={`text-xs px-2 py-0.5 rounded ${!colorFilter ? "bg-accent font-medium" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setColorFilter(undefined)}
          >
            All
          </button>
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c}
              className="size-5 rounded-full transition-all"
              style={{
                backgroundColor: c,
                outline: colorFilter === c ? "2px solid var(--ring)" : "none",
                outlineOffset: "2px",
              }}
              onClick={() => setColorFilter(colorFilter === c ? undefined : c)}
            />
          ))}
        </div>
        {tags.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">Tag:</span>
            <select
              className="text-xs bg-transparent border rounded px-1.5 py-0.5"
              value={tagFilter || ""}
              onChange={(e) => setTagFilter(e.target.value || undefined)}
            >
              <option value="">All</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Highlights list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading...</div>
        ) : highlights.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Highlighter className="size-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No highlights yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Select text in any document to create highlights.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {Object.values(grouped).map((group) => (
              <div key={group.docId} className="py-3">
                <button
                  className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                  onClick={() => navigateToHighlight(group.docId)}
                >
                  {group.title}
                </button>
                <div className="mt-2 space-y-1 px-4">
                  {group.items.map((h) => (
                    <button
                      key={h.id}
                      className="w-full text-left flex items-start gap-2 p-2 rounded hover:bg-accent/50 transition-colors"
                      onClick={() => navigateToHighlight(group.docId)}
                    >
                      <div
                        className="w-1 self-stretch rounded-full flex-shrink-0"
                        style={{ backgroundColor: h.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm line-clamp-2">{h.text}</p>
                        {h.note && (
                          <p className="text-xs text-muted-foreground mt-0.5 italic">
                            {h.note}
                          </p>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {timeAgo(h.created_at)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
