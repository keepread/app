"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Collection } from "@focus-reader/shared";

interface CollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collection?: Collection | null;
  onSaved?: () => void;
}

export function CollectionDialog({
  open,
  onOpenChange,
  collection,
  onSaved,
}: CollectionDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const isEditing = !!collection;

  useEffect(() => {
    if (open && collection) {
      setName(collection.name);
      setDescription(collection.description || "");
    } else if (open) {
      setName("");
      setDescription("");
    }
  }, [open, collection]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (isEditing) {
        await apiFetch(`/api/collections/${collection.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
        });
        toast("Collection updated");
      } else {
        await apiFetch("/api/collections", {
          method: "POST",
          body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
        });
        toast("Collection created");
      }
      onSaved?.();
      onOpenChange(false);
    } catch {
      toast.error(isEditing ? "Failed to update collection" : "Failed to create collection");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Collection" : "New Collection"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Input
            placeholder="Collection name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
            autoFocus
          />
          <Input
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
            {isEditing ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
