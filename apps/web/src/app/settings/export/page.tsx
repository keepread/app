"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileJson, FileText, Highlighter, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ExportPage() {
  const [loading, setLoading] = useState<string | null>(null);

  const downloadFile = async (
    url: string,
    key: string,
    fallbackFilename: string
  ) => {
    setLoading(key);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="(.+)"/);
      const filename = match?.[1] ?? fallbackFilename;

      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
      toast("Export downloaded");
    } catch {
      toast.error("Export failed");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold mb-1">Export</h1>
        <p className="text-sm text-muted-foreground">
          Download your data in various formats.
        </p>
      </div>

      <section className="space-y-4">
        {/* Full JSON */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <FileJson className="size-5 text-muted-foreground" />
            <div>
              <h3 className="text-sm font-medium">Full JSON Export</h3>
              <p className="text-xs text-muted-foreground">
                All documents, highlights, tags, collections, and preferences.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={loading === "json"}
            onClick={() =>
              downloadFile(
                "/api/export/json",
                "json",
                "focus-reader-export.json"
              )
            }
          >
            {loading === "json" ? (
              <Loader2 className="size-4 mr-1 animate-spin" />
            ) : (
              <Download className="size-4 mr-1" />
            )}
            Download
          </Button>
        </div>

        {/* All Documents Markdown ZIP */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <FileText className="size-5 text-muted-foreground" />
            <div>
              <h3 className="text-sm font-medium">All Documents (Markdown)</h3>
              <p className="text-xs text-muted-foreground">
                ZIP archive with each document as a Markdown file with
                frontmatter and highlights.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={loading === "markdown"}
            onClick={() =>
              downloadFile(
                "/api/export/markdown?mode=documents",
                "markdown",
                "focus-reader-export.zip"
              )
            }
          >
            {loading === "markdown" ? (
              <Loader2 className="size-4 mr-1 animate-spin" />
            ) : (
              <Download className="size-4 mr-1" />
            )}
            Download
          </Button>
        </div>

        {/* Highlights Markdown */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <Highlighter className="size-5 text-muted-foreground" />
            <div>
              <h3 className="text-sm font-medium">Highlights (Markdown)</h3>
              <p className="text-xs text-muted-foreground">
                All highlights grouped by document as a single Markdown file.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={loading === "highlights"}
            onClick={() =>
              downloadFile(
                "/api/export/markdown?mode=highlights",
                "highlights",
                "highlights-export.md"
              )
            }
          >
            {loading === "highlights" ? (
              <Loader2 className="size-4 mr-1 animate-spin" />
            ) : (
              <Download className="size-4 mr-1" />
            )}
            Download
          </Button>
        </div>
      </section>
    </div>
  );
}
