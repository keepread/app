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

interface DocumentListItemProps {
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
  snippet?: string;
}

export function DocumentListItem({
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
  snippet,
}: DocumentListItemProps) {
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
        "group relative flex gap-3 px-4 py-3.5 border-b cursor-pointer transition-colors border-l-2",
        isSelected ? "bg-accent/50 border-l-primary" : "border-l-transparent hover:bg-accent/50"
      )}
    >
      {showBulkSelect && (
        <div className="w-5 flex-shrink-0 pt-1">
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

      {/* Unread dot */}
      <div className="w-2 flex-shrink-0 pt-2">
        {!isRead && <div className="size-2 rounded-full bg-primary" />}
      </div>

      {/* Thumbnail */}
      <div className="relative flex w-20 h-14 flex-shrink-0 items-center justify-center rounded-md bg-muted overflow-hidden">
        <TypeIcon className="size-5 text-muted-foreground" />
        {thumbnailSrc && (
          <img
            src={thumbnailSrc}
            alt=""
            className={cn(
              "absolute inset-0",
              doc.cover_image_url ? "size-full object-cover" : "m-auto size-8 rounded-md object-contain"
            )}
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className={cn("text-sm truncate", !isRead && "font-semibold")}>
          {doc.title}
        </h3>
        {snippet ? (
          <p
            className="text-xs text-muted-foreground line-clamp-2 mt-0.5"
            dangerouslySetInnerHTML={{ __html: snippet }}
          />
        ) : doc.excerpt ? (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
            {doc.excerpt}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs text-muted-foreground">
          {doc.favicon_url && (
            <img
              src={doc.favicon_url}
              alt=""
              className="size-3.5 rounded-sm flex-shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
          {doc.site_name && <span>{doc.site_name}</span>}
          {doc.author && (
            <>
              <span>&middot;</span>
              <span>{doc.author}</span>
            </>
          )}
          {doc.reading_time_minutes > 0 && (
            <>
              <span>&middot;</span>
              <span>{doc.reading_time_minutes}min</span>
            </>
          )}
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
            <span className="text-[10px]">+{doc.tags.length - 3}</span>
          )}
        </div>
      </div>

      {/* Right meta - hidden on group hover when toolbar shows */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0 group-hover:opacity-0 transition-opacity">
        <span className="text-xs text-muted-foreground">
          {timeAgo(doc.saved_at)}
        </span>
        {isStarred && (
          <Star className="size-3 text-amber-400 fill-amber-400" />
        )}
        {doc.emailMeta?.needs_confirmation === 1 && (
          <span className="rounded bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 text-[10px] font-medium">
            Confirmation needed
          </span>
        )}
      </div>

      {/* Actions toolbar + context menu */}
      <DocumentListItemActions
        ref={actionsRef}
        document={doc}
        onMutate={onMutate}
      />

      {/* Reading progress bar */}
      {doc.reading_progress > 0 && doc.reading_progress < 100 && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5">
          <div
            className="h-full bg-primary/40"
            style={{ width: `${doc.reading_progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
