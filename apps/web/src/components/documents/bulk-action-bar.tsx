"use client";

import { Button } from "@/components/ui/button";

interface BulkActionBarProps {
  isBulkMode: boolean;
  selectedCount?: number;
  isBulkDeleting?: boolean;
  isBulkUpdating?: boolean;
  onMoveSelectedToArchive?: () => void;
  onMoveSelectedToLater?: () => void;
  onDeleteSelected?: () => void;
}

/**
 * Mobile-only floating action bar shown at the bottom of the document list
 * when bulk selection mode is active. Hidden on sm+ (desktop uses inline toolbar buttons).
 */
export function BulkActionBar({
  isBulkMode,
  selectedCount,
  isBulkDeleting = false,
  isBulkUpdating = false,
  onMoveSelectedToArchive,
  onMoveSelectedToLater,
  onDeleteSelected,
}: BulkActionBarProps) {
  if (!isBulkMode) return null;

  const disabled = (selectedCount ?? 0) === 0 || isBulkDeleting || isBulkUpdating;

  return (
    <div className="sm:hidden sticky bottom-0 border-t bg-background shadow-md">
      <div className="flex items-center gap-1 px-3 py-2">
        {onMoveSelectedToArchive && (
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-9 text-sm text-muted-foreground"
            onClick={onMoveSelectedToArchive}
            disabled={disabled}
          >
            Archive
          </Button>
        )}
        {onMoveSelectedToLater && (
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-9 text-sm text-muted-foreground"
            onClick={onMoveSelectedToLater}
            disabled={disabled}
          >
            Later
          </Button>
        )}
        {onDeleteSelected && (
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-9 text-sm text-destructive hover:text-destructive"
            onClick={onDeleteSelected}
            disabled={disabled}
          >
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}
