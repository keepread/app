import { defineExtensionMessaging } from "@webext-core/messaging";
import type { DocumentDetail } from "./api-client";

interface MessagingProtocol {
  captureHtml(): string;
  getPageStatus(data: { url: string; force?: boolean }): DocumentDetail | null;
  invalidatePageStatus(data: { url: string }): void;
  updateDocument(data: { id: string; patch: Record<string, unknown> }): void;
  getDocuments(data: {
    location?: string;
    isStarred?: boolean;
    limit?: number;
    cursor?: string;
  }): { items: DocumentDetail[]; total: number; nextCursor?: string };
}

export const { sendMessage, onMessage } = defineExtensionMessaging<MessagingProtocol>();
