"use client";

import { Inbox } from "lucide-react";
import { DocumentList } from "@/components/documents/document-list";

export default function InboxPage() {
  return <DocumentList location="inbox" title="Inbox" icon={Inbox} />;
}
