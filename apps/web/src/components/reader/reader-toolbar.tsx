"use client";

import { useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useDocument } from "@/hooks/use-documents";
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
  ArrowLeft,
  ChevronUp,
  ChevronDown,
  Star,
  Archive,
  MoreHorizontal,
  Inbox,
  Clock,
  ExternalLink,
  Copy,
  Trash2,
  BookOpen,
  BookX,
  PanelLeft,
  Maximize2,
  Minimize2,
  MailWarning,
} from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/contexts/app-context";

interface ReaderToolbarProps {
  documentId: string;
}

export function ReaderToolbar({ documentId }: ReaderToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { document: doc, mutate } = useDocument(documentId);
  const {
    toggleToc,
    focusMode,
    toggleFocusMode,
    documentIds,
    currentDocumentIndex,
    setCurrentDocumentIndex,
    setSelectedDocumentId,
  } = useApp();

  const hasPrev = currentDocumentIndex > 0;
  const hasNext = currentDocumentIndex < documentIds.length - 1;

  const goBack = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("doc");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const navigateDoc = useCallback(
    (index: number) => {
      if (index < 0 || index >= documentIds.length) return;
      const id = documentIds[index];
      setCurrentDocumentIndex(index);
      setSelectedDocumentId(id);
      const params = new URLSearchParams(searchParams.toString());
      params.set("doc", id);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [documentIds, setCurrentDocumentIndex, setSelectedDocumentId, searchParams, router, pathname]
  );

  const toggleStar = async () => {
    if (!doc) return;
    const newVal = doc.is_starred === 1 ? 0 : 1;
    await apiFetch(`/api/documents/${documentId}`, {
      method: "PATCH",
      body: JSON.stringify({ is_starred: newVal }),
    });
    mutate();
    toast(newVal ? "Starred" : "Unstarred");
  };

  const toggleRead = async () => {
    if (!doc) return;
    const newVal = doc.is_read === 1 ? 0 : 1;
    await apiFetch(`/api/documents/${documentId}`, {
      method: "PATCH",
      body: JSON.stringify({ is_read: newVal }),
    });
    mutate();
  };

  const moveToLocation = async (location: string) => {
    await apiFetch(`/api/documents/${documentId}`, {
      method: "PATCH",
      body: JSON.stringify({ location }),
    });
    mutate();
    toast(`Moved to ${location}`);
  };

  const deleteDocument = async () => {
    await apiFetch(`/api/documents/${documentId}`, { method: "DELETE" });
    toast("Document deleted");
    goBack();
  };

  const copyUrl = () => {
    if (doc?.url) {
      navigator.clipboard.writeText(doc.url);
      toast("Copied to clipboard");
    }
  };

  const openOriginal = () => {
    if (doc?.url) window.open(doc.url, "_blank");
  };

  const openConfirmationLink = () => {
    if (!doc?.html_content) return;
    // Match href with double or single quotes
    const match = doc.html_content.match(/href=["'](https?:\/\/[^"']+)["']/i);
    if (match) window.open(match[1], "_blank");
  };

  return (
    <>
      <div className="flex items-center h-12 px-3 border-b bg-background gap-1">
        {/* Left group */}
        <Button variant="ghost" size="icon" className="size-8" onClick={goBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={!hasPrev}
          onClick={() => navigateDoc(currentDocumentIndex - 1)}
        >
          <ChevronUp className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={!hasNext}
          onClick={() => navigateDoc(currentDocumentIndex + 1)}
        >
          <ChevronDown className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" className="size-8" onClick={toggleToc}>
          <PanelLeft className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" className="size-8" onClick={toggleFocusMode}>
          {focusMode ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </Button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right group */}
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={toggleStar}
        >
          <Star
            className={
              doc?.is_starred === 1
                ? "size-4 text-amber-400 fill-amber-400"
                : "size-4"
            }
          />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={toggleRead}
        >
          {doc?.is_read === 1 ? (
            <BookX className="size-4" />
          ) : (
            <BookOpen className="size-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => moveToLocation("archive")}
        >
          <Archive className="size-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => moveToLocation("inbox")}>
              <Inbox className="size-4 mr-2" /> Move to Inbox
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => moveToLocation("later")}>
              <Clock className="size-4 mr-2" /> Move to Later
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => moveToLocation("archive")}>
              <Archive className="size-4 mr-2" /> Move to Archive
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={openOriginal}>
              <ExternalLink className="size-4 mr-2" /> Open original
            </DropdownMenuItem>
            <DropdownMenuItem onClick={copyUrl}>
              <Copy className="size-4 mr-2" /> Copy URL
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={deleteDocument}
              className="text-destructive"
            >
              <Trash2 className="size-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Confirmation email banner */}
      {doc?.emailMeta?.needs_confirmation === 1 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950 border-b text-sm">
          <MailWarning className="size-4 text-amber-600 flex-shrink-0" />
          <span>This is a confirmation email.</span>
          <Button size="sm" variant="outline" onClick={openConfirmationLink}>
            Open confirmation link
          </Button>
        </div>
      )}
    </>
  );
}
