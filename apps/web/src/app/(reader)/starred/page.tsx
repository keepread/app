"use client";

import { Star } from "lucide-react";
import { DocumentList } from "@/components/documents/document-list";

export default function StarredPage() {
  return <DocumentList isStarred title="Starred" icon={Star} />;
}
