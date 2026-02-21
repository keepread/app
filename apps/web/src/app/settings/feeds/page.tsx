"use client";

import { useState, useRef } from "react";
import { useFeeds } from "@/hooks/use-feeds";
import { useTags } from "@/hooks/use-tags";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Trash2, Check, Pencil, Tag, X, Upload, Download, AlertCircle, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { AutoTagRule } from "@focus-reader/shared";
import { AutoTagEditor } from "@/components/settings/auto-tag-editor";
import { invalidateDocumentLists } from "@/lib/documents-cache";

export default function FeedsSettingsPage() {
  const { feeds, isLoading, mutate } = useFeeds();
  const { tags } = useTags();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [addUrl, setAddUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [autoTagOpenId, setAutoTagOpenId] = useState<string | null>(null);
  const [pollingAll, setPollingAll] = useState(false);
  const [pollingId, setPollingId] = useState<string | null>(null);

  const handleAddFeed = async () => {
    const url = addUrl.trim();
    if (!url) return;
    setAdding(true);
    try {
      await apiFetch("/api/feeds", {
        method: "POST",
        body: JSON.stringify({ url }),
      });
      mutate();
      await invalidateDocumentLists();
      setAddUrl("");
      toast("Feed added, fetching articles...");
    } catch {
      toast.error("Failed to add feed");
    } finally {
      setAdding(false);
    }
  };

  const handlePollAll = async () => {
    setPollingAll(true);
    try {
      await apiFetch("/api/feeds/poll", { method: "POST" });
      mutate();
      await invalidateDocumentLists();
      toast("Feeds refreshed");
    } catch {
      toast.error("Failed to refresh feeds");
    } finally {
      setPollingAll(false);
    }
  };

  const handlePollFeed = async (id: string) => {
    setPollingId(id);
    try {
      await apiFetch(`/api/feeds/${id}/poll`, { method: "POST" });
      mutate();
      await invalidateDocumentLists();
      toast("Feed refreshed");
    } catch {
      toast.error("Failed to refresh feed");
    } finally {
      setPollingId(null);
    }
  };

  const toggleActive = async (id: string, currentActive: number) => {
    const newVal = currentActive === 1 ? 0 : 1;
    await apiFetch(`/api/feeds/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: newVal }),
    });
    mutate();
    toast(newVal ? "Feed resumed" : "Feed paused");
  };

  const deleteFeed = async (id: string) => {
    setDeletingId(id);
    try {
      await apiFetch(`/api/feeds/${id}`, { method: "DELETE" });
      mutate();
      toast("Feed deleted");
    } catch {
      toast.error("Failed to delete feed");
    } finally {
      setDeletingId(null);
    }
  };

  const startRename = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const saveRename = async (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    await apiFetch(`/api/feeds/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title: trimmed }),
    });
    mutate();
    setEditingId(null);
    toast("Renamed");
  };

  const addTagToFeed = async (feedId: string, tagId: string) => {
    await apiFetch(`/api/feeds/${feedId}/tags`, {
      method: "POST",
      body: JSON.stringify({ tagId }),
    });
    mutate();
  };

  const saveAutoTagRules = async (feedId: string, rules: AutoTagRule[]) => {
    await apiFetch(`/api/feeds/${feedId}`, {
      method: "PATCH",
      body: JSON.stringify({ auto_tag_rules: JSON.stringify(rules) }),
    });
    mutate();
    toast("Auto-tag rules saved");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/feeds/import", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error();
      const result = (await res.json()) as { imported: number; skipped: number };
      mutate();
      await invalidateDocumentLists();
      toast(`Imported ${result.imported} feeds (${result.skipped} skipped)`);
    } catch {
      toast.error("Failed to import OPML");
    }
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleExport = async () => {
    try {
      const res = await fetch("/api/feeds/export");
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "focus-reader-feeds.opml";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to export OPML");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">Feeds</h1>
        <p className="text-sm text-muted-foreground">
          Manage your RSS feed subscriptions.
        </p>
      </div>

      {/* OPML import/export */}
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".opml,.xml"
          className="hidden"
          onChange={handleImport}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="size-4 mr-2" />
          Import OPML
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="size-4 mr-2" />
          Export OPML
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handlePollAll}
          disabled={pollingAll}
        >
          <RefreshCw className={`size-4 mr-2 ${pollingAll ? "animate-spin" : ""}`} />
          Refresh Feeds
        </Button>
      </div>

      {/* Add feed */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Feed URL (e.g. https://example.com/feed.xml)"
          value={addUrl}
          onChange={(e) => setAddUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAddFeed();
          }}
          className="flex-1"
        />
        <Button onClick={handleAddFeed} disabled={adding || !addUrl.trim()}>
          Add
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      )}

      {!isLoading && feeds.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No feeds yet. Add an RSS feed URL above or import an OPML file.
        </p>
      )}

      <div className="divide-y rounded-lg border">
        {feeds.map((feed) => (
          <div key={feed.id} className="px-4 py-3 space-y-2">
            <div className="flex items-center gap-3">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary flex-shrink-0">
                {feed.title.charAt(0).toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                {editingId === feed.id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveRename(feed.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="h-7 text-sm"
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => saveRename(feed.id)}
                      aria-label="Save name"
                    >
                      <Check className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => setEditingId(null)}
                      aria-label="Cancel rename"
                    >
                      <X className="size-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">
                      {feed.title}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 opacity-0 group-hover:opacity-100 hover:opacity-100"
                      onClick={() => startRename(feed.id, feed.title)}
                      aria-label="Rename feed"
                    >
                      <Pencil className="size-3" />
                    </Button>
                    {feed.error_count > 0 && (
                      <span
                        className="inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive"
                        title={feed.last_error || "Feed has errors"}
                      >
                        <AlertCircle className="size-3" />
                        Error
                      </span>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">
                    {feed.feed_url}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    &middot; {feed.documentCount} docs
                  </span>
                  {feed.unreadCount > 0 && (
                    <span className="text-xs text-muted-foreground">
                      &middot; {feed.unreadCount} unread
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground"
                  onClick={() => handlePollFeed(feed.id)}
                  disabled={pollingId === feed.id}
                  aria-label="Refresh feed"
                >
                  <RefreshCw className={`size-4 ${pollingId === feed.id ? "animate-spin" : ""}`} />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground"
                      aria-label="Manage tags"
                    >
                      <Tag className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {tags.length === 0 && (
                      <DropdownMenuItem disabled>No tags</DropdownMenuItem>
                    )}
                    {tags.map((tag) => (
                      <DropdownMenuItem
                        key={tag.id}
                        onClick={() => addTagToFeed(feed.id, tag.id)}
                      >
                        <span
                          className="size-2 rounded-full mr-2"
                          style={{ backgroundColor: tag.color || "#6366f1" }}
                        />
                        {tag.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Switch
                  checked={feed.is_active === 1}
                  onCheckedChange={() => toggleActive(feed.id, feed.is_active)}
                  aria-label={feed.is_active === 1 ? "Pause feed" : "Resume feed"}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteFeed(feed.id)}
                  disabled={deletingId === feed.id}
                  aria-label="Delete feed"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>

            {/* Auto-tag rules */}
            <button
              onClick={() =>
                setAutoTagOpenId(autoTagOpenId === feed.id ? null : feed.id)
              }
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {autoTagOpenId === feed.id ? (
                <ChevronDown className="size-3" />
              ) : (
                <ChevronRight className="size-3" />
              )}
              Auto-tag rules
            </button>
            {autoTagOpenId === feed.id && (
              <AutoTagEditor
                rules={
                  feed.auto_tag_rules
                    ? JSON.parse(feed.auto_tag_rules)
                    : []
                }
                onChange={(rules) => saveAutoTagRules(feed.id, rules)}
                availableTags={tags}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
