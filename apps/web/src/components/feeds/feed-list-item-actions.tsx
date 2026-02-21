"use client";

import { forwardRef, useCallback, useImperativeHandle, useState } from "react";
import { useRouter } from "next/navigation";
import type { FeedWithStats } from "@focus-reader/shared";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  RefreshCw,
  Pencil,
  ExternalLink,
  MoreHorizontal,
  Play,
  Pause,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { FeedEditDialog } from "./feed-edit-dialog";
import { invalidateDocumentLists } from "@/lib/documents-cache";

interface FeedListItemActionsProps {
  feed: FeedWithStats;
  onMutate: () => void;
}

export interface FeedListItemActionsHandle {
  openMenu: () => void;
}

export const FeedListItemActions = forwardRef<
  FeedListItemActionsHandle,
  FeedListItemActionsProps
>(function FeedListItemActions({ feed, onMutate }, ref) {
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  useImperativeHandle(ref, () => ({
    openMenu: () => setDropdownOpen(true),
  }));

  const refreshFeed = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsPolling(true);
      try {
        await apiFetch(`/api/feeds/${feed.id}/poll`, {
          method: "POST",
        });
        onMutate();
        await invalidateDocumentLists();
        toast("Feed refresh started");
      } catch {
        toast.error("Failed to refresh feed");
      } finally {
        setIsPolling(false);
      }
    },
    [feed.id, onMutate]
  );

  const toggleActive = useCallback(async () => {
    try {
      await apiFetch(`/api/feeds/${feed.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: feed.is_active === 1 ? 0 : 1 }),
      });
      onMutate();
      toast(feed.is_active === 1 ? "Feed paused" : "Feed activated");
    } catch {
      toast.error("Failed to toggle feed status");
    }
  }, [feed.id, feed.is_active, onMutate]);

  const deleteFeed = useCallback(async () => {
    if (!confirm(`Delete "${feed.title}"? This cannot be undone.`)) {
      return;
    }
    try {
      await apiFetch(`/api/feeds/${feed.id}`, { method: "DELETE" });
      onMutate();
      toast("Feed deleted");
    } catch {
      toast.error("Failed to delete feed");
    }
  }, [feed.id, feed.title, onMutate]);

  const viewArticles = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      router.push(`/feeds/${feed.id}`);
    },
    [router, feed.id]
  );

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
              onClick={refreshFeed}
              disabled={isPolling}
            >
              <RefreshCw className={`size-3.5 ${isPolling ? "animate-spin" : ""}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Refresh feed</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={(e) => {
                e.stopPropagation();
                setEditDialogOpen(true);
              }}
            >
              <Pencil className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Edit feed</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={viewArticles}
            >
              <ExternalLink className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">View articles</TooltipContent>
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
            <DropdownMenuItem
              onClick={() => {
                toggleActive();
                setDropdownOpen(false);
              }}
            >
              {feed.is_active === 1 ? (
                <>
                  <Pause className="size-4 mr-2" /> Pause feed
                </>
              ) : (
                <>
                  <Play className="size-4 mr-2" /> Activate feed
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setEditDialogOpen(true);
                setDropdownOpen(false);
              }}
            >
              <Pencil className="size-4 mr-2" /> Edit settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={deleteFeed} className="text-destructive">
              <Trash2 className="size-4 mr-2" /> Delete feed
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Edit dialog */}
      <FeedEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        feed={feed}
        onSaved={onMutate}
      />
    </>
  );
});
