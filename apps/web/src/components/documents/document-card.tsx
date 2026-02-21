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
  onClick: () => void;
  onDoubleClick: () => void;
  onMutate: () => void;
}

export function DocumentCard({
  document: doc,
  isSelected,
  onClick,
  onDoubleClick,
  onMutate,
}: DocumentCardProps) {
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
        "group relative flex flex-col rounded-lg border cursor-pointer transition-colors overflow-hidden",
        isSelected ? "ring-2 ring-primary border-primary" : "hover:bg-accent/50"
      )}
    >
      {/* Image area */}
      <div className="aspect-[16/9] bg-muted overflow-hidden">
        {doc.cover_image_url ? (
          <img
            src={`/api/covers/${doc.id}`}
            alt=""
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <TypeIcon className="size-8 text-muted-foreground/50" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 flex-1 flex flex-col">
        <h3 className={cn("text-sm line-clamp-2 leading-snug", !isRead && "font-semibold")}>
          {doc.title}
        </h3>
        <div className="flex items-center gap-1.5 mt-auto pt-2 text-xs text-muted-foreground">
          {doc.site_name && <span className="truncate">{doc.site_name}</span>}
          <span className="ml-auto shrink-0">{timeAgo(doc.saved_at)}</span>
        </div>
      </div>

      {/* Indicators */}
      {!isRead && (
        <div className="absolute top-2 left-2 size-2 rounded-full bg-primary" />
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
