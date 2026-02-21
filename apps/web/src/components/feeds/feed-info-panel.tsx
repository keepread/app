"use client";

import { useState } from "react";
import type { FeedWithStats } from "@focus-reader/shared";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  Pencil,
  ExternalLink,
  Trash2,
  Play,
  Pause,
  Copy,
  Rss,
} from "lucide-react";
import { timeAgo, formatDate } from "@/lib/format";
import { toast } from "sonner";
import Link from "next/link";
import { FeedEditDialog } from "./feed-edit-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { invalidateDocumentLists } from "@/lib/documents-cache";

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground font-medium">{value}</dd>
    </div>
  );
}

interface FeedInfoPanelProps {
  feed: FeedWithStats | null;
  onMutate: () => void;
}

export function FeedInfoPanel({ feed, onMutate }: FeedInfoPanelProps) {
  const router = useRouter();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  const refreshFeed = async () => {
    if (!feed) return;
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
  };

  const toggleActive = async () => {
    if (!feed) return;
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
  };

  const deleteFeed = async () => {
    if (!feed) return;
    setIsDeleting(true);
    try {
      await apiFetch(`/api/feeds/${feed.id}`, { method: "DELETE" });
      toast("Feed deleted");
      onMutate();
      // Navigate back to feeds list without selection
      router.push("/feeds");
    } catch {
      toast.error("Failed to delete feed");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast(`${label} copied to clipboard`);
  };

  if (!feed) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <p className="text-sm text-muted-foreground">
          Select a feed to see its details
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="p-4 space-y-6">
        {/* Feed Icon */}
        <div className="flex justify-center">
          <div className="size-16 rounded bg-muted flex items-center justify-center">
            {feed.icon_url ? (
              <img
                src={feed.icon_url}
                alt={feed.title}
                className="size-16 rounded object-cover"
              />
            ) : (
              <Rss className="size-8 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Title & Stats */}
        <div className="text-center">
          <h2 className="text-sm font-semibold">{feed.title}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {feed.documentCount} article{feed.documentCount === 1 ? "" : "s"}
            {feed.unreadCount > 0 && ` • ${feed.unreadCount} unread`}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={refreshFeed}
            disabled={isPolling}
          >
            <RefreshCw className={`size-4 mr-2 ${isPolling ? "animate-spin" : ""}`} />
            Refresh Feed
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => setEditDialogOpen(true)}
          >
            <Pencil className="size-4 mr-2" />
            Edit Settings
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            asChild
          >
            <Link href={`/feeds/${feed.id}`}>
              <ExternalLink className="size-4 mr-2" />
              View Articles
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={toggleActive}
          >
            {feed.is_active === 1 ? (
              <>
                <Pause className="size-4 mr-2" />
                Pause Feed
              </>
            ) : (
              <>
                <Play className="size-4 mr-2" />
                Activate Feed
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start text-destructive hover:text-destructive"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="size-4 mr-2" />
            Delete Feed
          </Button>
        </div>

        {/* Status */}
        <div>
          <SectionHeading>STATUS</SectionHeading>
          <div className="mt-2 space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={feed.is_active === 1 ? "default" : "secondary"}>
                {feed.is_active === 1 ? "Active" : "Paused"}
              </Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Last fetched</span>
              <span className="text-foreground font-medium">
                {feed.last_fetched_at ? timeAgo(feed.last_fetched_at) : "Never"}
              </span>
            </div>
            {feed.error_count > 0 && feed.last_error && (
              <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                <strong>Error ({feed.error_count}):</strong> {feed.last_error}
              </div>
            )}
          </div>
        </div>

        {/* Settings */}
        <div>
          <SectionHeading>SETTINGS</SectionHeading>
          <div className="mt-2 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Fetch interval</span>
              <span className="text-foreground font-medium">
                {feed.fetch_interval_minutes} min
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Full content</span>
              <span className="text-foreground font-medium">
                {feed.fetch_full_content === 1 ? "Yes" : "No"}
              </span>
            </div>
          </div>
        </div>

        {/* URLs */}
        <div>
          <SectionHeading>URLS</SectionHeading>
          <div className="mt-2 space-y-2">
            <div className="text-sm">
              <div className="text-muted-foreground mb-1">Feed URL</div>
              <button
                onClick={() => copyToClipboard(feed.feed_url, "Feed URL")}
                className="text-xs text-foreground hover:text-primary flex items-center gap-1 break-all text-left"
              >
                <Copy className="size-3 flex-shrink-0" />
                <span className="break-all">{feed.feed_url}</span>
              </button>
            </div>
            {feed.site_url && (
              <div className="text-sm">
                <div className="text-muted-foreground mb-1">Site URL</div>
                <button
                  onClick={() => copyToClipboard(feed.site_url!, "Site URL")}
                  className="text-xs text-foreground hover:text-primary flex items-center gap-1 break-all text-left"
                >
                  <Copy className="size-3 flex-shrink-0" />
                  <span className="break-all">{feed.site_url}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Metadata */}
        <div>
          <SectionHeading>METADATA</SectionHeading>
          <dl className="mt-2 space-y-2">
            <MetadataRow
              label="Articles"
              value={`${feed.documentCount}`}
            />
            <MetadataRow
              label="Unread"
              value={`${feed.unreadCount}`}
            />
            <MetadataRow
              label="Created"
              value={formatDate(feed.created_at)}
            />
            <MetadataRow
              label="Next poll"
              value={
                feed.is_active === 1 && feed.last_fetched_at
                  ? timeAgo(
                      new Date(
                        new Date(feed.last_fetched_at).getTime() +
                          feed.fetch_interval_minutes * 60000
                      ).toISOString()
                    )
                  : "N/A"
              }
            />
          </dl>
        </div>

        {feed.description && (
          <div>
            <SectionHeading>DESCRIPTION</SectionHeading>
            <p className="text-sm text-muted-foreground mt-2">
              {feed.description}
            </p>
          </div>
        )}
      </div>

      {/* Edit dialog */}
      <FeedEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        feed={feed}
        onSaved={onMutate}
      />

      {/* Delete confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Feed</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{feed.title}&rdquo;? This will
              remove the feed and all its articles. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              onClick={deleteFeed}
              disabled={isDeleting}
              variant="destructive"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
