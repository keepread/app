"use client";

import { use, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { useCollection, useCollections } from "@/hooks/use-collections";
import { SortableDocumentRow } from "@/components/collections/sortable-document-row";
import { CollectionDialog } from "@/components/dialogs/collection-dialog";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useApp } from "@/contexts/app-context";
import { Pencil, Trash2, FolderOpen, PanelLeftOpen, PanelRightOpen } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { Skeleton } from "@/components/ui/skeleton";

export default function CollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { sidebarCollapsed, toggleSidebar, rightPanelVisible, toggleRightPanel } = useApp();
  const isMobile = useIsMobile();
  const { collection, isLoading, mutate } = useCollection(id);
  const { mutate: mutateList } = useCollections();
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !collection) return;

      const docs = collection.documents;
      const oldIndex = docs.findIndex((d) => d.id === active.id);
      const newIndex = docs.findIndex((d) => d.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(docs, oldIndex, newIndex);

      // Optimistic update
      mutate(
        { ...collection, documents: reordered },
        false
      );

      try {
        await apiFetch(`/api/collections/${id}/reorder`, {
          method: "PUT",
          body: JSON.stringify({
            orderedDocumentIds: reordered.map((d) => d.id),
          }),
        });
      } catch {
        mutate(); // Revert on error
        toast.error("Failed to reorder");
      }
    },
    [collection, id, mutate]
  );

  const handleRemove = async (documentId: string) => {
    try {
      await apiFetch(`/api/collections/${id}/documents`, {
        method: "DELETE",
        body: JSON.stringify({ documentId }),
      });
      mutate();
      mutateList();
      toast("Document removed from collection");
    } catch {
      toast.error("Failed to remove document");
    }
  };

  const handleDelete = async () => {
    try {
      await apiFetch(`/api/collections/${id}`, { method: "DELETE" });
      mutateList();
      toast("Collection deleted");
      router.push("/inbox");
    } catch {
      toast.error("Failed to delete collection");
    }
  };

  const handleDocClick = (docId: string) => {
    const currentParams = new URLSearchParams(searchParams.toString());
    currentParams.set("doc", docId);
    router.push(`/collections/${id}?${currentParams.toString()}`);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Collection not found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-6 py-4">
        {sidebarCollapsed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7" onClick={toggleSidebar}>
                <PanelLeftOpen className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <span>Show left panel</span>
              <kbd className="ml-2 rounded border bg-muted px-1 py-0.5 text-[10px] font-mono">[</kbd>
            </TooltipContent>
          </Tooltip>
        )}
        <FolderOpen className="size-5 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold truncate">{collection.name}</h1>
          {collection.description && (
            <p className="text-sm text-muted-foreground truncate">
              {collection.description}
            </p>
          )}
        </div>
        <span className="text-sm text-muted-foreground">
          {collection.documents.length} docs
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => setEditDialogOpen(true)}
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-destructive"
          onClick={handleDelete}
        >
          <Trash2 className="size-4" />
        </Button>
        {!rightPanelVisible && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7" onClick={toggleRightPanel}>
                <PanelRightOpen className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <span>Show right panel</span>
              {!isMobile && <kbd className="ml-2 rounded border bg-muted px-1 py-0.5 text-[10px] font-mono">]</kbd>}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Document list with drag-and-drop */}
      <div className="flex-1 overflow-y-auto p-4">
        {collection.documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <FolderOpen className="size-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              No documents in this collection yet.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Add documents from the reader toolbar.
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={collection.documents.map((d) => d.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1">
                {collection.documents.map((doc) => (
                  <SortableDocumentRow
                    key={doc.id}
                    document={doc}
                    onRemove={handleRemove}
                    onClick={handleDocClick}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <CollectionDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        collection={collection}
        onSaved={() => {
          mutate();
          mutateList();
        }}
      />
    </div>
  );
}
