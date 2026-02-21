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
  onClick: () => void;
  onDoubleClick: () => void;
  onMutate: () => void;
  snippet?: string;
}

export function DocumentListItem({
  document: doc,
  isSelected,
  onClick,
  onDoubleClick,
  onMutate,
  snippet,
}: DocumentListItemProps) {
  const isRead = doc.is_read === 1;
  const isStarred = doc.is_starred === 1;
  const TypeIcon = TYPE_ICONS[doc.type] || FileText;
  const actionsRef = useRef<DocumentListItemActionsHandle>(null);

  return (
    <div
      data-selected={isSelected}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        actionsRef.current?.openMenu();
      }}
      className={cn(
        "group relative flex gap-3 px-4 py-3.5 border-b cursor-pointer transition-colors border-l-2",
        isSelected ? "bg-accent/50 border-l-primary" : "border-l-transparent hover:bg-accent/50"
      )}
    >
      {/* Unread dot */}
      <div className="w-2 flex-shrink-0 pt-2">
        {!isRead && <div className="size-2 rounded-full bg-primary" />}
      </div>

      {/* Thumbnail */}
      <div className="flex w-20 h-14 flex-shrink-0 items-center justify-center rounded-md bg-muted overflow-hidden">
        {doc.cover_image_url ? (
          <img
            src={`/api/covers/${doc.id}`}
            alt=""
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <TypeIcon className="size-5 text-muted-foreground" />
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
        <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
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
