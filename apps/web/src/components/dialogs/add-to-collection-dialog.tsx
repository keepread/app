"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { Loader2, Check, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { useCollections } from "@/hooks/use-collections";

interface AddToCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  currentCollectionIds?: string[];
}

export function AddToCollectionDialog({
  open,
  onOpenChange,
  documentId,
  currentCollectionIds = [],
}: AddToCollectionDialogProps) {
  const { collections, mutate } = useCollections();
  const [selected, setSelected] = useState<Set<string>>(new Set(currentCollectionIds));
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const toAdd = [...selected].filter((id) => !currentCollectionIds.includes(id));
      const toRemove = currentCollectionIds.filter((id) => !selected.has(id));

      await Promise.all([
        ...toAdd.map((collectionId) =>
          apiFetch(`/api/collections/${collectionId}/documents`, {
            method: "POST",
            body: JSON.stringify({ documentId }),
          })
        ),
        ...toRemove.map((collectionId) =>
          apiFetch(`/api/collections/${collectionId}/documents`, {
            method: "DELETE",
            body: JSON.stringify({ documentId }),
          })
        ),
      ]);
      mutate();
      toast("Collections updated");
      onOpenChange(false);
    } catch {
      toast.error("Failed to update collections");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Add to Collection</DialogTitle>
        </DialogHeader>
        <div className="max-h-64 overflow-y-auto space-y-1 py-2">
          {collections.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No collections yet. Create one first.
            </p>
          ) : (
            collections.map((c) => (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors"
              >
                <FolderOpen className="size-4 text-muted-foreground flex-shrink-0" />
                <span className="flex-1 text-left truncate">{c.name}</span>
                {selected.has(c.id) && (
                  <Check className="size-4 text-primary flex-shrink-0" />
                )}
              </button>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
