"use client";

import { Archive } from "lucide-react";
import { DocumentList } from "@/components/documents/document-list";

export default function ArchivePage() {
  return <DocumentList location="archive" title="Archive" icon={Archive} />;
}
