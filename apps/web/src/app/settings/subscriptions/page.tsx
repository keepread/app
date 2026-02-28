"use client";

import { useState } from "react";
import { useSubscriptions } from "@/hooks/use-subscriptions";
import { useTags } from "@/hooks/use-tags";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Trash2, Copy, Check, Pencil, Tag, X, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import type { AutoTagRule } from "@focus-reader/shared";
import { AutoTagEditor } from "@/components/settings/auto-tag-editor";

export default function SubscriptionsSettingsPage() {
  const { subscriptions, isLoading, mutate } = useSubscriptions();
  const { tags } = useTags();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [autoTagOpenId, setAutoTagOpenId] = useState<string | null>(null);

  const toggleActive = async (id: string, currentActive: number) => {
    const newVal = currentActive === 1 ? 0 : 1;
    await apiFetch(`/api/subscriptions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: newVal }),
    });
    mutate();
    toast(newVal ? "Subscription resumed" : "Subscription paused");
  };

  const deleteSub = async (id: string) => {
    setDeletingId(id);
    try {
      await apiFetch(`/api/subscriptions/${id}`, { method: "DELETE" });
      mutate();
      toast("Subscription deleted");
    } catch {
      toast.error("Failed to delete subscription");
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
    await apiFetch(`/api/subscriptions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ display_name: trimmed }),
    });
    mutate();
    setEditingId(null);
    toast("Renamed");
  };

  const copyEmail = (id: string, email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedId(id);
    toast("Email copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const addTagToSub = async (subId: string, tagId: string) => {
    await apiFetch(`/api/subscriptions/${subId}/tags`, {
      method: "POST",
      body: JSON.stringify({ tagId }),
    });
    mutate();
  };

  const saveAutoTagRules = async (subId: string, rules: AutoTagRule[]) => {
    await apiFetch(`/api/subscriptions/${subId}`, {
      method: "PATCH",
      body: JSON.stringify({ auto_tag_rules: JSON.stringify(rules) }),
    });
    mutate();
    toast("Auto-tag rules saved");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">Subscriptions</h1>
        <p className="text-sm text-muted-foreground">
          Manage your newsletter subscriptions.
        </p>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      )}

      {!isLoading && subscriptions.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No subscriptions yet. They&apos;ll appear here when emails arrive.
        </p>
      )}

      <div className="divide-y rounded-lg border">
        {subscriptions.map((sub) => (
          <div key={sub.id} className="px-4 py-3 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary flex-shrink-0">
                {sub.display_name.charAt(0).toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                {editingId === sub.id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveRename(sub.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="h-7 text-sm"
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => saveRename(sub.id)}
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
                      {sub.display_name}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 opacity-0 group-hover:opacity-100 hover:opacity-100"
                      onClick={() => startRename(sub.id, sub.display_name)}
                      aria-label="Rename subscription"
                    >
                      <Pencil className="size-3" />
                    </Button>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  <button
                    onClick={() => copyEmail(sub.id, sub.pseudo_email)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {copiedId === sub.id ? (
                      <Check className="size-3 text-green-500" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                    <span className="font-mono truncate max-w-[200px]">
                      {sub.pseudo_email}
                    </span>
                  </button>
                  <span className="text-xs text-muted-foreground">
                    &middot; {sub.documentCount} docs
                  </span>
                  {sub.unreadCount > 0 && (
                    <span className="text-xs text-muted-foreground">
                      &middot; {sub.unreadCount} unread
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 self-end sm:self-auto">
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
                        onClick={() => addTagToSub(sub.id, tag.id)}
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
                  checked={sub.is_active === 1}
                  onCheckedChange={() => toggleActive(sub.id, sub.is_active)}
                  aria-label={sub.is_active === 1 ? "Pause subscription" : "Resume subscription"}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteSub(sub.id)}
                  disabled={deletingId === sub.id}
                  aria-label="Delete subscription"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>

            {/* Auto-tag rules */}
            <button
              onClick={() =>
                setAutoTagOpenId(autoTagOpenId === sub.id ? null : sub.id)
              }
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {autoTagOpenId === sub.id ? (
                <ChevronDown className="size-3" />
              ) : (
                <ChevronRight className="size-3" />
              )}
              Auto-tag rules
            </button>
            {autoTagOpenId === sub.id && (
              <AutoTagEditor
                rules={
                  sub.auto_tag_rules
                    ? JSON.parse(sub.auto_tag_rules)
                    : []
                }
                onChange={(rules) => saveAutoTagRules(sub.id, rules)}
                availableTags={tags}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
