"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTags } from "@/hooks/use-tags";
import { apiFetch } from "@/lib/api-client";
import { Loader2, Plus, X, Check } from "lucide-react";
import { toast } from "sonner";
import type { TagWithCount } from "@focus-reader/shared";

interface TagManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId?: string;
  documentTagIds?: string[];
  onTagToggle?: (tagId: string, added: boolean) => void;
}

export function TagManagerDialog({
  open,
  onOpenChange,
  documentId,
  documentTagIds = [],
  onTagToggle,
}: TagManagerDialogProps) {
  const { tags, mutate } = useTags();
  const [newTagName, setNewTagName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreateTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const newTag = await apiFetch<TagWithCount>("/api/tags", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      mutate();
      setNewTagName("");
      if (documentId) {
        await toggleTag(newTag.id, true);
      }
    } catch {
      toast.error("Failed to create tag");
    } finally {
      setCreating(false);
    }
  };

  const toggleTag = async (tagId: string, forceAdd?: boolean) => {
    if (!documentId) return;
    const isTagged = documentTagIds.includes(tagId);
    const shouldAdd = forceAdd ?? !isTagged;
    try {
      if (shouldAdd) {
        await apiFetch(`/api/documents/${documentId}`, {
          method: "PATCH",
          body: JSON.stringify({ addTagId: tagId }),
        });
      } else {
        await apiFetch(`/api/documents/${documentId}`, {
          method: "PATCH",
          body: JSON.stringify({ removeTagId: tagId }),
        });
      }
      onTagToggle?.(tagId, shouldAdd);
    } catch {
      toast.error("Failed to update tag");
    }
  };

  const deleteTag = async (tagId: string) => {
    try {
      await apiFetch(`/api/tags/${tagId}`, { method: "DELETE" });
      mutate();
      toast("Tag deleted");
    } catch {
      toast.error("Failed to delete tag");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>
            {documentId ? "Edit Tags" : "Manage Tags"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Create new tag */}
          <div className="flex gap-2">
            <Input
              placeholder="New tag name..."
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.stopPropagation();
                  handleCreateTag();
                }
              }}
              className="h-8 text-sm"
            />
            <Button
              size="sm"
              onClick={handleCreateTag}
              disabled={creating || !newTagName.trim()}
              className="h-8"
            >
              {creating ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Plus className="size-3" />
              )}
            </Button>
          </div>

          {/* Tag list */}
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {tags.map((tag) => {
              const isTagged = documentTagIds.includes(tag.id);
              return (
                <div
                  key={tag.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted group"
                >
                  {documentId && (
                    <button
                      onClick={() => toggleTag(tag.id)}
                      className="flex size-4 items-center justify-center rounded border text-xs"
                    >
                      {isTagged && <Check className="size-3" />}
                    </button>
                  )}
                  <span
                    className="size-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tag.color || "#6366f1" }}
                  />
                  <span className="flex-1 text-sm truncate">{tag.name}</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5">
                    {tag.documentCount}
                  </Badge>
                  {!documentId && (
                    <button
                      onClick={() => deleteTag(tag.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
              );
            })}
            {tags.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No tags yet
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
