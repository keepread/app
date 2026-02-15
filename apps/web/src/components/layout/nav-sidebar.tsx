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
  Search,
  Settings,
  ChevronDown,
  ChevronRight,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  Filter,
  Highlighter,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useSubscriptions } from "@/hooks/use-subscriptions";
import { useFeeds } from "@/hooks/use-feeds";
import { useTags } from "@/hooks/use-tags";
import { useSavedViews } from "@/hooks/use-saved-views";
import { useApp } from "@/contexts/app-context";
import { Button } from "@/components/ui/button";
import { AddBookmarkDialog } from "@/components/dialogs/add-bookmark-dialog";

const NAV_ITEMS = [
  { label: "Inbox", icon: Inbox, path: "/inbox", badge: true },
  { label: "Later", icon: Clock, path: "/later" },
  { label: "Archive", icon: Archive, path: "/archive" },
  { label: "All", icon: Library, path: "/all" },
  { label: "Starred", icon: Star, path: "/starred" },
  { label: "Highlights", icon: Highlighter, path: "/highlights" },
] as const;

export function NavSidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useApp();
  const { subscriptions } = useSubscriptions();
  const { feeds } = useFeeds();
  const { tags } = useTags();
  const { views } = useSavedViews();
  const [subsOpen, setSubsOpen] = useState(true);
  const [feedsOpen, setFeedsOpen] = useState(true);
  const [tagsOpen, setTagsOpen] = useState(true);
  const [viewsOpen, setViewsOpen] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  if (sidebarCollapsed) return null;

  return (
    <aside className="flex h-full w-60 flex-shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      {/* Brand bar */}
      <div className="flex items-center justify-between px-3 py-3">
        <div className="flex items-center gap-2">
          <Image
            src="/focus-reader-logo.svg"
            alt="Focus Reader logo"
            width={18}
            height={18}
            className="size-[18px]"
            priority
          />
          <span className="text-sm font-semibold">Focus Reader</span>
        </div>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="size-7" onClick={toggleSidebar}>
            <PanelLeftClose className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-7" onClick={() => setAddDialogOpen(true)}>
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-2">
        <div className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.path ||
              pathname.startsWith(item.path + "/");
            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary font-semibold"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                <item.icon className="size-4 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
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

        {/* Feeds */}
        <div className="mt-4">
          <button
            onClick={() => setFeedsOpen(!feedsOpen)}
            className="flex w-full items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            <span>Feeds</span>
            {feedsOpen ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </button>
          {feedsOpen && (
            <div className="space-y-0.5">
              {feeds.map((feed) => (
                <Link
                  key={feed.id}
                  href={`/feeds/${feed.id}`}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-sidebar-accent",
                    pathname === `/feeds/${feed.id}` &&
                      "bg-sidebar-accent font-medium"
                  )}
                >
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                    {feed.title.charAt(0).toUpperCase()}
                  </span>
                  <span className="flex-1 truncate">{feed.title}</span>
                  {feed.unreadCount > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {feed.unreadCount}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Tags */}
        <div className="mt-4">
          <button
            onClick={() => setTagsOpen(!tagsOpen)}
            className="flex w-full items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            <span>Tags</span>
            {tagsOpen ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </button>
          {tagsOpen && (
            <div className="space-y-0.5">
              {tags.map((tag) => (
                <Link
                  key={tag.id}
                  href={`/tags/${tag.id}`}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-sidebar-accent",
                    pathname === `/tags/${tag.id}` &&
                      "bg-sidebar-accent font-medium"
                  )}
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: tag.color || "#6366f1" }}
                  />
                  <span className="flex-1 truncate">{tag.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {tag.documentCount}
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
        <div className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground opacity-50 cursor-not-allowed">
          <Search className="size-4" />
          <span>Search</span>
        </div>
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          <Settings className="size-4" />
          <span>Settings</span>
        </Link>
      </div>
      <AddBookmarkDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
    </aside>
  );
}
