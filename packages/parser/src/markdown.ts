import TurndownService from "turndown";
import { parseHTML } from "linkedom";

let turndownInstance: TurndownService | null = null;

function getTurndown(): TurndownService {
  if (!turndownInstance) {
    turndownInstance = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
      bulletListMarker: "-",
    });

    // Keep data tables as HTML in markdown output.
    // Layout tables are already unwrapped by the sanitizer, so only
    // genuine data tables reach here.
    turndownInstance.keep(["table"]);
  }
  return turndownInstance;
}

export function htmlToMarkdown(html: string): string {
  const turndown = getTurndown();
  // Parse HTML using linkedom so Turndown doesn't need the global `document`
  // (which doesn't exist in Cloudflare Workers runtime)
  const { document } = parseHTML(
    `<!DOCTYPE html><html><body>${html}</body></html>`
  );
  return turndown.turndown(document.body as unknown as HTMLElement);
}
