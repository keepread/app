"use client";

import { use } from "react";
import { Rss } from "lucide-react";
import { DocumentList } from "@/components/documents/document-list";
import { useFeeds } from "@/hooks/use-feeds";

export default function FeedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { feeds } = useFeeds();
  const feed = feeds?.find((f) => f.id === id);

  return (
    <DocumentList
      feedId={id}
      title={feed?.title || "Feed"}
      icon={Rss}
    />
  );
}
