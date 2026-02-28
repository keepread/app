"use client";

import { Library } from "lucide-react";
import { DocumentList } from "@/components/documents/document-list";

export default function AllPage() {
  return <DocumentList title="All Documents" icon={Library} />;
}
