"use client";

import { use } from "react";
import { DocumentList } from "@/components/documents/document-list";
import { useTags } from "@/hooks/use-tags";

export default function TagPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { tags } = useTags();
  const tag = tags?.find((t) => t.id === id);

  return <DocumentList tagId={id} title={tag?.name || "Tag"} />;
}
