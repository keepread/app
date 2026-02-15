"use client";

import { useState } from "react";
import useSWR from "swr";
import { apiFetch } from "@/lib/api-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ApiKey } from "@focus-reader/shared";

export default function ApiKeysPage() {
  const {
    data: keys,
    isLoading,
    mutate,
  } = useSWR("/api/api-keys", (url: string) => apiFetch<ApiKey[]>(url));

  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const createKey = async () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      const result = await apiFetch<{ key: string; record: ApiKey }>(
        "/api/api-keys",
        {
          method: "POST",
          body: JSON.stringify({ label: trimmed }),
        }
      );
      setNewKey(result.key);
      setLabel("");
      mutate();
    } catch {
      toast.error("Failed to create API key");
    } finally {
      setCreating(false);
    }
  };

  const revokeKey = async (id: string) => {
    setRevoking(id);
    try {
      await apiFetch(`/api/api-keys/${id}`, { method: "DELETE" });
      mutate();
      toast("API key revoked");
    } catch {
      toast.error("Failed to revoke API key");
    } finally {
      setRevoking(null);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast("Copied to clipboard");
  };

  const closeCreateDialog = () => {
    setShowCreate(false);
    setNewKey(null);
    setLabel("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">API Keys</h1>
        <p className="text-sm text-muted-foreground">
          Create and manage API keys for programmatic access to your Focus Reader
          data.
        </p>
      </div>

      <Button onClick={() => setShowCreate(true)}>
        <Plus className="size-4 mr-2" />
        Create API Key
      </Button>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      )}

      {!isLoading && keys && keys.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No API keys yet.
        </p>
      )}

      {keys && keys.length > 0 && (
        <div className="divide-y rounded-lg border">
          {keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <div className="space-y-0.5">
                <div className="text-sm font-medium">{key.label}</div>
                <div className="text-xs text-muted-foreground">
                  <span className="font-mono">{key.key_prefix}...</span>
                  <span className="mx-2">·</span>
                  Created {new Date(key.created_at).toLocaleDateString()}
                  {key.last_used_at && (
                    <>
                      <span className="mx-2">·</span>
                      Last used{" "}
                      {new Date(key.last_used_at).toLocaleDateString()}
                    </>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-destructive"
                onClick={() => revokeKey(key.id)}
                disabled={revoking === key.id}
              >
                {revoking === key.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={(open) => !open && closeCreateDialog()}>
        <DialogContent>
          {newKey ? (
            <>
              <DialogHeader>
                <DialogTitle>API Key Created</DialogTitle>
                <DialogDescription>
                  Copy your API key now. It won't be shown again.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono break-all">
                  {newKey}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(newKey)}
                >
                  <Copy className="size-4" />
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={closeCreateDialog}>Done</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Create API Key</DialogTitle>
                <DialogDescription>
                  Give your API key a label to help you identify it later.
                </DialogDescription>
              </DialogHeader>
              <Input
                placeholder="e.g. CLI tool, automation script"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createKey();
                }}
              />
              <DialogFooter>
                <Button variant="outline" onClick={closeCreateDialog}>
                  Cancel
                </Button>
                <Button
                  onClick={createKey}
                  disabled={creating || !label.trim()}
                >
                  {creating && <Loader2 className="size-4 animate-spin mr-2" />}
                  Create
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
