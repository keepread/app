"use client";

import { Clock } from "lucide-react";
import { DocumentList } from "@/components/documents/document-list";

export default function LaterPage() {
  return <DocumentList location="later" title="Later" icon={Clock} />;
}
