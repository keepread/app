"use client";

import { useState } from "react";
import Link from "next/link";
import { useTags } from "@/hooks/use-tags";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Pencil, Trash2, Check, X, Palette } from "lucide-react";
import { toast } from "sonner";
import { ColorPicker } from "@/components/settings/color-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `about ${years} year${years === 1 ? "" : "s"} ago`;
}

export default function TagsPage() {
  const { tags, isLoading, mutate } = useTags();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [colorPickerId, setColorPickerId] = useState<string | null>(null);

  const startEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const saveEdit = async (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    try {
      await apiFetch(`/api/tags/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: trimmed }),
      });
      mutate();
      setEditingId(null);
      toast("Tag renamed");
    } catch {
      toast.error("Failed to rename tag");
    }
  };

  const deleteTag = async (id: string) => {
    setDeletingId(id);
    try {
      await apiFetch(`/api/tags/${id}`, { method: "DELETE" });
      mutate();
      toast("Tag deleted");
    } catch {
      toast.error("Failed to delete tag");
    } finally {
      setDeletingId(null);
    }
  };

  const updateColor = async (id: string, color: string) => {
    try {
      await apiFetch(`/api/tags/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ color }),
      });
      mutate();
      setColorPickerId(null);
      toast("Color updated");
    } catch {
      toast.error("Failed to update color");
    }
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold mb-1">Tags</h1>
            <p className="text-sm text-muted-foreground">
              Manage your tags and their colors
            </p>
          </div>

          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          )}

          {!isLoading && tags.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No tags yet. Tags are created when you tag documents.
            </p>
          )}

          {!isLoading && tags.length > 0 && (
            <div className="divide-y rounded-lg border">
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className="px-4 py-3 flex items-center gap-3"
                >
                  {/* Color indicator */}
                  <Popover
                    open={colorPickerId === tag.id}
                    onOpenChange={(open) =>
                      setColorPickerId(open ? tag.id : null)
                    }
                  >
                    <PopoverTrigger asChild>
                      <button
                        className="flex-shrink-0 size-6 rounded-full flex items-center justify-center hover:ring-2 hover:ring-offset-2 hover:ring-primary/50 transition-all"
                        style={{ backgroundColor: tag.color || "#6366f1" }}
                        aria-label="Change color"
                      >
                        <Palette className="size-3 text-white opacity-0 hover:opacity-100 transition-opacity" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-3" align="start">
                      <ColorPicker
                        value={tag.color}
                        onChange={(color) => updateColor(tag.id, color)}
                        onClose={() => setColorPickerId(null)}
                      />
                    </PopoverContent>
                  </Popover>

                  {/* Tag name */}
                  <div className="flex-1 min-w-0">
                    {editingId === tag.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(tag.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className="h-8 text-sm"
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => saveEdit(tag.id)}
                          aria-label="Save"
                        >
                          <Check className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => setEditingId(null)}
                          aria-label="Cancel"
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <Link
                          href={`/tags/${tag.id}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {tag.name}
                        </Link>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {tag.documentCount} document
                            {tag.documentCount === 1 ? "" : "s"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            &middot; Created {formatTimeAgo(tag.created_at)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {editingId !== tag.id && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground"
                        onClick={() => startEdit(tag.id, tag.name)}
                        aria-label="Edit tag name"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteTag(tag.id)}
                        disabled={deletingId === tag.id}
                        aria-label="Delete tag"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
