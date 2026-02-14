"use client";

import { useState } from "react";
import useSWR from "swr";
import { apiFetch } from "@/lib/api-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Denylist } from "@focus-reader/shared";

export default function DenylistPage() {
  const { data: entries, isLoading, mutate } = useSWR(
    "/api/denylist",
    (url: string) => apiFetch<Denylist[]>(url)
  );
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);

  const addEntry = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setAdding(true);
    try {
      await apiFetch("/api/denylist", {
        method: "POST",
        body: JSON.stringify({ domain: trimmed }),
      });
      mutate();
      setEmail("");
      toast("Email blocked");
    } catch {
      toast.error("Failed to add to denylist");
    } finally {
      setAdding(false);
    }
  };

  const removeEntry = async (id: string) => {
    await apiFetch(`/api/denylist/${id}`, { method: "DELETE" });
    mutate();
    toast("Removed from denylist");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">Denylist</h1>
        <p className="text-sm text-muted-foreground">
          Block emails from specific senders. Blocked emails will be
          automatically discarded.
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="sender@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addEntry();
          }}
          className="max-w-sm"
        />
        <Button onClick={addEntry} disabled={adding || !email.trim()}>
          {adding ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          <span className="ml-2">Add</span>
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      )}

      {!isLoading && entries && entries.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No blocked senders.
        </p>
      )}

      {entries && entries.length > 0 && (
        <div className="divide-y rounded-lg border">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between px-4 py-2.5"
            >
              <span className="text-sm">{entry.domain}</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-destructive"
                onClick={() => removeEntry(entry.id)}
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
