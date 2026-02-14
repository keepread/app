"use client";

import { useState } from "react";
import { useSubscriptions } from "@/hooks/use-subscriptions";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function SubscriptionsSettingsPage() {
  const { subscriptions, isLoading, mutate } = useSubscriptions();
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
          <div key={sub.id} className="flex items-center gap-4 px-4 py-3">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
              {sub.display_name.charAt(0).toUpperCase()}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {sub.display_name}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {sub.sender_address} &middot; {sub.documentCount} documents
              </p>
            </div>
            <Switch
              checked={sub.is_active === 1}
              onCheckedChange={() => toggleActive(sub.id, sub.is_active)}
            />
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              onClick={() => deleteSub(sub.id)}
              disabled={deletingId === sub.id}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
