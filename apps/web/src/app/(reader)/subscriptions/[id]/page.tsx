"use client";

import { use } from "react";
import { Mail } from "lucide-react";
import { DocumentList } from "@/components/documents/document-list";
import { useSubscriptions } from "@/hooks/use-subscriptions";

export default function SubscriptionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { subscriptions } = useSubscriptions();
  const sub = subscriptions?.find((s) => s.id === id);

  return (
    <DocumentList
      subscriptionId={id}
      title={sub?.display_name || sub?.sender_name || "Subscription"}
      icon={Mail}
    />
  );
}
