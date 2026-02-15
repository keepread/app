"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DocumentWithTags } from "@focus-reader/shared";

interface SortableDocumentRowProps {
  document: DocumentWithTags & { sort_order: number; added_at: string };
  onRemove: (documentId: string) => void;
  onClick: (documentId: string) => void;
}

export function SortableDocumentRow({
  document: doc,
  onRemove,
  onClick,
}: SortableDocumentRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: doc.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-md border bg-background px-2 py-2 ${
        isDragging ? "opacity-50 shadow-lg" : ""
      }`}
    >
      <button
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <button
        className="flex-1 text-left min-w-0"
        onClick={() => onClick(doc.id)}
      >
        <p className="text-sm font-medium truncate">{doc.title}</p>
        {doc.author && (
          <p className="text-xs text-muted-foreground truncate">{doc.author}</p>
        )}
      </button>
      {doc.reading_progress > 0 && (
        <span className="text-xs text-muted-foreground flex-shrink-0">
          {Math.round(doc.reading_progress)}%
        </span>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="size-7 flex-shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(doc.id);
        }}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}
