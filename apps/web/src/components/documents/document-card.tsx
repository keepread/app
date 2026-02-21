"use client";

import { useRef } from "react";
import type { DocumentWithTags } from "@focus-reader/shared";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";
import { Star, Mail, FileText, Bookmark, Rss } from "lucide-react";
import {
  DocumentListItemActions,
  type DocumentListItemActionsHandle,
} from "./document-list-item-actions";

const TYPE_ICONS = {
  email: Mail,
  article: FileText,
  bookmark: Bookmark,
  rss: Rss,
  pdf: FileText,
  post: FileText,
} as const;

interface DocumentCardProps {
  document: DocumentWithTags;
  isSelected: boolean;
  showBulkSelect: boolean;
  isBulkSelected: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onToggleBulkSelect: () => void;
  onMutate: () => void;
}

export function DocumentCard({
  document: doc,
  isSelected,
  showBulkSelect,
  isBulkSelected,
  onClick,
  onDoubleClick,
  onMouseEnter,
  onMouseLeave,
  onToggleBulkSelect,
  onMutate,
}: DocumentCardProps) {
  const isRead = doc.is_read === 1;
  const isStarred = doc.is_starred === 1;
  const TypeIcon = TYPE_ICONS[doc.type] || FileText;
  const actionsRef = useRef<DocumentListItemActionsHandle>(null);
  const thumbnailSrc = doc.cover_image_url
    ? `/api/covers/${doc.id}`
    : doc.favicon_url || null;

  return (
    <div
      data-selected={isSelected}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onContextMenu={(e) => {
        e.preventDefault();
        actionsRef.current?.openMenu();
      }}
      className={cn(
        "group relative flex flex-col rounded-lg border cursor-pointer transition-colors overflow-hidden",
        isSelected ? "ring-2 ring-primary border-primary" : "hover:bg-accent/50"
      )}
    >
      {showBulkSelect && (
        <div className="absolute left-2 top-2 z-20">
          <input
            type="checkbox"
            checked={isBulkSelected}
            onChange={onToggleBulkSelect}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            className="size-4 cursor-pointer accent-primary"
            aria-label={`Select ${doc.title}`}
          />
        </div>
      )}

      {/* Image area */}
      <div className="relative aspect-[16/9] bg-muted overflow-hidden">
        <div className="flex size-full items-center justify-center">
          <TypeIcon className="size-8 text-muted-foreground/50" />
        </div>
        {thumbnailSrc && (
          <img
            src={thumbnailSrc}
            alt=""
            className={cn(
              "absolute inset-0",
              doc.cover_image_url ? "size-full object-cover" : "m-auto size-12 rounded-lg object-contain"
            )}
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}
      </div>

      {/* Content */}
      <div className="p-3 flex-1 flex flex-col">
        <h3 className={cn("text-sm line-clamp-2 leading-snug", !isRead && "font-semibold")}>
          {doc.title}
        </h3>
        <div className="mt-auto pt-2 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {doc.favicon_url && (
              <img
                src={doc.favicon_url}
                alt=""
                className="size-3.5 rounded-sm flex-shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            )}
            {doc.site_name && <span className="truncate">{doc.site_name}</span>}
            <span className="ml-auto shrink-0">{timeAgo(doc.saved_at)}</span>
          </div>
          {doc.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              {doc.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag.id}
                  className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                  style={{ borderLeft: `2px solid ${tag.color || "#6366f1"}` }}
                >
                  {tag.name}
                </span>
              ))}
              {doc.tags.length > 3 && (
                <span className="text-[10px] text-muted-foreground">+{doc.tags.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Indicators */}
      {!isRead && (
        <div className={cn("absolute top-2 size-2 rounded-full bg-primary", showBulkSelect ? "left-8" : "left-2")} />
      )}
      {isStarred && (
        <Star className="absolute top-2 right-2 size-3.5 text-amber-400 fill-amber-400 drop-shadow" />
      )}

      {/* Actions toolbar + context menu */}
      <DocumentListItemActions
        ref={actionsRef}
        document={doc}
        onMutate={onMutate}
      />
    </div>
  );
}
