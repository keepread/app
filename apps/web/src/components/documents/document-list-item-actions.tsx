"use client";

import { forwardRef, useCallback, useImperativeHandle, useState } from "react";
import type { DocumentWithTags } from "@focus-reader/shared";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { invalidateDocumentLists } from "@/lib/documents-cache";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Star,
  Archive,
  MoreHorizontal,
  Inbox,
  Clock,
  ExternalLink,
  Copy,
  Trash2,
  BookOpen,
  BookX,
  Tag,
  FolderPlus,
} from "lucide-react";
import { toast } from "sonner";
import { TagManagerDialog } from "@/components/dialogs/tag-manager-dialog";
import { AddToCollectionDialog } from "@/components/dialogs/add-to-collection-dialog";

interface DocumentListItemActionsProps {
  document: DocumentWithTags;
  onMutate: () => void;
}

export interface DocumentListItemActionsHandle {
  openMenu: () => void;
}

export const DocumentListItemActions = forwardRef<
  DocumentListItemActionsHandle,
  DocumentListItemActionsProps
>(function DocumentListItemActions({ document: doc, onMutate }, ref) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);

  const isStarred = doc.is_starred === 1;
  const isRead = doc.is_read === 1;

  useImperativeHandle(ref, () => ({
    openMenu: () => setDropdownOpen(true),
  }));

  const toggleStar = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      const newVal = isStarred ? 0 : 1;
      await apiFetch(`/api/documents/${doc.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_starred: newVal }),
      });
      onMutate();
      await invalidateDocumentLists();
      toast(newVal ? "Starred" : "Unstarred");
    },
    [doc.id, isStarred, onMutate]
  );

  const toggleRead = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      const newVal = isRead ? 0 : 1;
      await apiFetch(`/api/documents/${doc.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_read: newVal }),
      });
      onMutate();
      await invalidateDocumentLists();
      toast(newVal ? "Marked as read" : "Marked as unread");
    },
    [doc.id, isRead, onMutate]
  );

  const moveToLocation = useCallback(
    async (location: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      await apiFetch(`/api/documents/${doc.id}`, {
        method: "PATCH",
        body: JSON.stringify({ location }),
      });
      onMutate();
      await invalidateDocumentLists();
      toast(`Moved to ${location}`);
    },
    [doc.id, onMutate]
  );

  const deleteDocument = useCallback(async () => {
    await apiFetch(`/api/documents/${doc.id}`, { method: "DELETE" });
    onMutate();
    await invalidateDocumentLists();
    toast("Document deleted");
  }, [doc.id, onMutate]);

  const copyUrl = useCallback(() => {
    if (doc.url) {
      navigator.clipboard.writeText(doc.url);
      toast("Copied to clipboard");
    }
  }, [doc.url]);

  const openOriginal = useCallback(() => {
    if (doc.url) window.open(doc.url, "_blank");
  }, [doc.url]);

  return (
    <>
      {/* Floating toolbar - visible on group hover */}
      <div
        className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 backdrop-blur-sm rounded-md border shadow-sm px-0.5 py-0.5"
        onClick={(e) => e.stopPropagation()}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={toggleStar}
            >
              <Star
                className={
                  isStarred
                    ? "size-3.5 text-amber-400 fill-amber-400"
                    : "size-3.5"
                }
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {isStarred ? "Unstar" : "Star"}{" "}
            <kbd className="ml-1 text-[10px] opacity-60">S</kbd>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={toggleRead}
            >
              {isRead ? (
                <BookX className="size-3.5" />
              ) : (
                <BookOpen className="size-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {isRead ? "Mark as unread" : "Mark as read"}{" "}
            <kbd className="ml-1 text-[10px] opacity-60">M</kbd>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={(e) => moveToLocation("archive", e)}
            >
              <Archive className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Archive <kbd className="ml-1 text-[10px] opacity-60">E</kbd>
          </TooltipContent>
        </Tooltip>

        <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">More actions</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => setTagDialogOpen(true)}>
              <Tag className="size-4 mr-2" /> Add tag
              <DropdownMenuShortcut>T</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCollectionDialogOpen(true)}>
              <FolderPlus className="size-4 mr-2" /> Add to Collection
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={(e) => toggleRead(e)}>
              {isRead ? (
                <BookX className="size-4 mr-2" />
              ) : (
                <BookOpen className="size-4 mr-2" />
              )}
              {isRead ? "Mark as unread" : "Mark as read"}
              <DropdownMenuShortcut>M</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => moveToLocation("inbox")}>
              <Inbox className="size-4 mr-2" /> Move to Inbox
              <DropdownMenuShortcut>Shift+E</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => moveToLocation("later")}>
              <Clock className="size-4 mr-2" /> Move to Later
              <DropdownMenuShortcut>L</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => moveToLocation("archive")}>
              <Archive className="size-4 mr-2" /> Move to Archive
              <DropdownMenuShortcut>E</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={openOriginal}>
              <ExternalLink className="size-4 mr-2" /> Open original
              <DropdownMenuShortcut>O</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={copyUrl}>
              <Copy className="size-4 mr-2" /> Copy URL
              <DropdownMenuShortcut>Shift+C</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={deleteDocument}
              className="text-destructive"
            >
              <Trash2 className="size-4 mr-2" /> Delete document
              <DropdownMenuShortcut>D</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Dialogs */}
      <TagManagerDialog
        open={tagDialogOpen}
        onOpenChange={setTagDialogOpen}
        documentId={doc.id}
        documentTagIds={doc.tags?.map((t) => t.id) ?? []}
        onTagToggle={() => onMutate()}
      />
      <AddToCollectionDialog
        open={collectionDialogOpen}
        onOpenChange={setCollectionDialogOpen}
        documentId={doc.id}
      />
    </>
  );
});
