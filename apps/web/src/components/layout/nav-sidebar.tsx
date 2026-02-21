"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Inbox,
  Clock,
  Archive,
  Library,
  Star,
  Settings,
  ChevronDown,
  ChevronRight,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  Filter,
  Highlighter,
  FolderOpen,
  Tag,
  Rss,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useSubscriptions } from "@/hooks/use-subscriptions";
import { useFeeds } from "@/hooks/use-feeds";
import { useSavedViews } from "@/hooks/use-saved-views";
import { useCollections } from "@/hooks/use-collections";
import { useApp } from "@/contexts/app-context";
import { Button } from "@/components/ui/button";
import { AddBookmarkDialog } from "@/components/dialogs/add-bookmark-dialog";
import { CollectionDialog } from "@/components/dialogs/collection-dialog";
import { UserMenu } from "@/components/layout/user-menu";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const NAV_ITEMS = [
  { label: "Inbox", icon: Inbox, path: "/inbox", badge: true },
  { label: "Later", icon: Clock, path: "/later" },
  { label: "Archive", icon: Archive, path: "/archive" },
  { label: "All", icon: Library, path: "/all" },
  { label: "Starred", icon: Star, path: "/starred" },
  { label: "Highlights", icon: Highlighter, path: "/highlights" },
  { label: "Tags", icon: Tag, path: "/tags" },
  { label: "Feeds", icon: Rss, path: "/feeds" },
] as const;

export function NavSidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, mutateDocumentList } = useApp();
  const { subscriptions } = useSubscriptions();
  const { mutate: mutateFeeds } = useFeeds();
  const { views } = useSavedViews();
  const { collections, mutate: mutateCollections } = useCollections();
  const [subsOpen, setSubsOpen] = useState(true);
  const [collectionsOpen, setCollectionsOpen] = useState(true);
  const [viewsOpen, setViewsOpen] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [addFeedOpen, setAddFeedOpen] = useState(false);
  const [addFeedUrl, setAddFeedUrl] = useState("");
  const [addingFeed, setAddingFeed] = useState(false);

  const handleAddFeed = async () => {
    const url = addFeedUrl.trim();
    if (!url) return;
    setAddingFeed(true);
    try {
      await apiFetch("/api/feeds", {
        method: "POST",
        body: JSON.stringify({ url }),
      });
      await mutateFeeds();
      mutateDocumentList();
      setAddFeedUrl("");
      setAddFeedOpen(false);
      toast("Feed added");
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "DUPLICATE_FEED") {
        toast.error("This feed is already added");
      } else {
        toast.error("Failed to add feed");
      }
    } finally {
      setAddingFeed(false);
    }
  };

  if (sidebarCollapsed) return null;

  return (
    <aside className="flex h-full w-60 flex-shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      {/* Brand bar */}
      <div className="flex items-center justify-between px-3 py-3">
        <div className="flex items-center gap-2">
          <Image
            src="/navicon.svg"
            alt="Focus Reader logo"
            width={18}
            height={18}
            className="size-[18px]"
            priority
          />
          <span className="text-sm font-semibold">Focus Reader</span>
        </div>
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7" onClick={toggleSidebar}>
                <PanelLeftClose className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <span>Toggle sidebar</span>
              <kbd className="ml-2 rounded border bg-muted px-1 py-0.5 text-[10px] font-mono">[</kbd>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => setAddDialogOpen(true)}>
                <Plus className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <span>Add document</span>
              <kbd className="ml-2 rounded border bg-muted px-1 py-0.5 text-[10px] font-mono">A</kbd>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-2">
        <div className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.path ||
              pathname.startsWith(item.path + "/");
            const isFeedsItem = item.path === "/feeds";
            return (
              <div key={item.path} className="flex items-center gap-1">
                <Link
                  href={item.path}
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-primary font-semibold"
                      : "text-sidebar-foreground hover:bg-sidebar-accent"
                  )}
                >
                  <item.icon className="size-4 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
                {isFeedsItem && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setAddFeedOpen(true);
                    }}
                    className="mr-1 rounded p-1 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                    aria-label="Add feed"
                    title="Add feed"
                  >
                    <Plus className="size-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Subscriptions */}
        <div className="mt-4">
          <button
            onClick={() => setSubsOpen(!subsOpen)}
            className="flex w-full items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            <span>Subscriptions</span>
            {subsOpen ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </button>
          {subsOpen && (
            <div className="space-y-0.5">
              {subscriptions.map((sub) => (
                <Link
                  key={sub.id}
                  href={`/subscriptions/${sub.id}`}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-sidebar-accent",
                    pathname === `/subscriptions/${sub.id}` &&
                      "bg-sidebar-accent font-medium"
                  )}
                >
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                    {sub.display_name.charAt(0).toUpperCase()}
                  </span>
                  <span className="flex-1 truncate">{sub.display_name}</span>
                  {sub.unreadCount > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {sub.unreadCount}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Collections */}
        <div className="mt-4">
          <div
            className="flex w-full items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            <button
              onClick={() => setCollectionsOpen(!collectionsOpen)}
              className="flex flex-1 items-center justify-between hover:text-foreground"
            >
              <span>Collections</span>
              {collectionsOpen ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
            </button>
            <button
              onClick={() => setCollectionDialogOpen(true)}
              className="ml-1 text-muted-foreground hover:text-foreground"
            >
              <Plus className="size-3" />
            </button>
          </div>
          {collectionsOpen && (
            <div className="space-y-0.5">
              {collections.map((col) => (
                <Link
                  key={col.id}
                  href={`/collections/${col.id}`}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-sidebar-accent",
                    pathname === `/collections/${col.id}` &&
                      "bg-sidebar-accent font-medium"
                  )}
                >
                  <FolderOpen className="size-4 flex-shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{col.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {col.documentCount}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Saved Views */}
        <div className="mt-4">
          <button
            onClick={() => setViewsOpen(!viewsOpen)}
            className="flex w-full items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            <span>Saved Views</span>
            {viewsOpen ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </button>
          {viewsOpen && (
            <div className="space-y-0.5">
              {views
                .filter((v) => v.pinned_order !== null)
                .map((view) => (
                  <Link
                    key={view.id}
                    href={`/views/${view.id}`}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-sidebar-accent",
                      pathname === `/views/${view.id}` &&
                        "bg-sidebar-accent font-medium"
                    )}
                  >
                    <Filter className="size-4 flex-shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{view.name}</span>
                  </Link>
                ))}
            </div>
          )}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t px-2 py-2 space-y-0.5">
        <UserMenu />
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          <Settings className="size-4" />
          <span>Settings</span>
        </Link>
      </div>
      <AddBookmarkDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
      <CollectionDialog
        open={collectionDialogOpen}
        onOpenChange={setCollectionDialogOpen}
        onSaved={() => mutateCollections()}
      />

      <Dialog open={addFeedOpen} onOpenChange={setAddFeedOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Feed</DialogTitle>
            <DialogDescription>Add an RSS/Atom feed URL.</DialogDescription>
          </DialogHeader>
          <Input
            placeholder="https://example.com/feed.xml"
            value={addFeedUrl}
            onChange={(e) => setAddFeedUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddFeed();
            }}
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddFeedOpen(false);
                setAddFeedUrl("");
              }}
              disabled={addingFeed}
            >
              Cancel
            </Button>
            <Button onClick={handleAddFeed} disabled={addingFeed || !addFeedUrl.trim()}>
              {addingFeed && <Loader2 className="size-4 animate-spin" />}
              Add feed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </aside>
  );
}
