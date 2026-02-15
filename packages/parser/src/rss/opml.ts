import { XMLParser } from "fast-xml-parser";

export interface OpmlFeed {
  title: string;
  feedUrl: string;
  siteUrl: string | null;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function flattenOutlines(outlines: unknown): OpmlFeed[] {
  const results: OpmlFeed[] = [];
  const items = Array.isArray(outlines) ? outlines : outlines ? [outlines] : [];

  for (const item of items) {
    if (typeof item !== "object" || item === null) continue;
    const outline = item as Record<string, unknown>;
    const xmlUrl = outline["@_xmlUrl"] as string | undefined;

    if (xmlUrl) {
      results.push({
        title: (outline["@_title"] as string) || (outline["@_text"] as string) || "",
        feedUrl: xmlUrl,
        siteUrl: (outline["@_htmlUrl"] as string) || null,
      });
    }

    // Recurse into nested outlines (categories)
    if (outline["outline"]) {
      results.push(...flattenOutlines(outline["outline"]));
    }
  }

  return results;
}

export function parseOpml(xml: string): OpmlFeed[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    isArray: (name) => name === "outline",
  });

  const doc = parser.parse(xml);
  const body = doc?.opml?.body;
  if (!body) return [];

  return flattenOutlines(body.outline);
}

export function generateOpml(feeds: OpmlFeed[], title?: string): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<opml version="2.0">',
    "  <head>",
    `    <title>${escapeXml(title || "Focus Reader Feeds")}</title>`,
    "  </head>",
    "  <body>",
  ];

  for (const feed of feeds) {
    const attrs = [
      `text="${escapeXml(feed.title)}"`,
      `title="${escapeXml(feed.title)}"`,
      `type="rss"`,
      `xmlUrl="${escapeXml(feed.feedUrl)}"`,
    ];
    if (feed.siteUrl) {
      attrs.push(`htmlUrl="${escapeXml(feed.siteUrl)}"`);
    }
    lines.push(`    <outline ${attrs.join(" ")} />`);
  }

  lines.push("  </body>");
  lines.push("</opml>");

  return lines.join("\n");
}
