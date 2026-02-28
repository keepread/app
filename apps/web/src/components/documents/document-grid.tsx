"use client";

import type { DocumentWithTags } from "@focus-reader/shared";
import { DocumentCard } from "./document-card";

interface DocumentGridProps {
  documents: DocumentWithTags[];
  selectedId: string | null;
  showBulkSelect: boolean;
  selectedBulkIds: Set<string>;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onHover: (id: string | null) => void;
  onToggleBulkSelect: (id: string) => void;
  onMutate: () => void;
}

export function DocumentGrid({
  documents,
  selectedId,
  showBulkSelect,
  selectedBulkIds,
  onSelect,
  onOpen,
  onHover,
  onToggleBulkSelect,
  onMutate,
}: DocumentGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3 sm:p-4">
      {documents.map((doc) => (
        <DocumentCard
          key={doc.id}
          document={doc}
          isSelected={doc.id === selectedId}
          showBulkSelect={showBulkSelect}
          isBulkSelected={selectedBulkIds.has(doc.id)}
          onClick={() => onSelect(doc.id)}
          onDoubleClick={() => onOpen(doc.id)}
          onMouseEnter={() => onHover(doc.id)}
          onMouseLeave={() => onHover(null)}
          onToggleBulkSelect={() => onToggleBulkSelect(doc.id)}
          onMutate={onMutate}
        />
      ))}
    </div>
  );
}
