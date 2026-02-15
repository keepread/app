"use client";

import type { HighlightWithTags } from "@focus-reader/shared";
import { timeAgo } from "@/lib/format";

interface NotebookHighlightCardProps {
  highlight: HighlightWithTags;
  onClick: () => void;
}

export function NotebookHighlightCard({ highlight, onClick }: NotebookHighlightCardProps) {
  return (
    <button
      className="w-full text-left p-3 rounded-lg border hover:bg-accent/50 transition-colors group"
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <div
          className="w-1 self-stretch rounded-full flex-shrink-0"
          style={{ backgroundColor: highlight.color }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm line-clamp-3">{highlight.text}</p>
          {highlight.note && (
            <p className="text-xs text-muted-foreground mt-1 italic line-clamp-2">
              {highlight.note}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            {highlight.tags.length > 0 && (
              <div className="flex gap-1">
                {highlight.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary"
                  >
                    <span
                      className="size-1 rounded-full"
                      style={{ backgroundColor: tag.color || "#6366f1" }}
                    />
                    {tag.name}
                  </span>
                ))}
              </div>
            )}
            <span className="text-[10px] text-muted-foreground ml-auto">
              {timeAgo(highlight.created_at)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
