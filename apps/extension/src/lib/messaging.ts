import { defineExtensionMessaging } from "@webext-core/messaging";
import type { DocumentDetail } from "./api-client";

interface MessagingProtocol {
  captureHtml(): string;
  getPageStatus(data: { url: string }): DocumentDetail | null;
  invalidatePageStatus(data: { url: string }): void;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<MessagingProtocol>();
