import { onMessage } from "@/lib/messaging";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  main() {
    onMessage("captureHtml", () => {
      return document.documentElement.outerHTML;
    });
  },
});
