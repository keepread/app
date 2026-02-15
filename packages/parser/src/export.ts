import yaml from "js-yaml";
import type {
  Document,
  Tag,
  HighlightWithTags,
  HighlightWithDocument,
} from "@focus-reader/shared";

export interface MarkdownExportOptions {
  includeHighlights?: boolean;
  includeNotes?: boolean;
  highlightFormat?: "inline" | "appendix";
}

export interface DocumentExportData {
  document: Document;
  tags: Tag[];
  highlights: HighlightWithTags[];
  markdownContent?: string | null;
}

export function generateFrontmatter(doc: Document, tags: Tag[]): string {
  const fm: Record<string, unknown> = {
    title: doc.title,
  };
  if (doc.author) fm.author = doc.author;
  if (doc.url) fm.url = doc.url;
  if (tags.length > 0) fm.tags = tags.map((t) => t.name);
  fm.saved_date = doc.saved_at?.split("T")[0] ?? null;
  if (doc.published_at) fm.published_date = doc.published_at.split("T")[0];
  fm.type = doc.type;
  if (doc.word_count) fm.word_count = doc.word_count;
  if (doc.reading_progress) fm.reading_progress = Math.round(doc.reading_progress);

  return `---\n${yaml.dump(fm, { lineWidth: -1 }).trim()}\n---`;
}

export function formatDocumentAsMarkdown(
  data: DocumentExportData,
  options?: MarkdownExportOptions
): string {
  const parts: string[] = [];

  // Frontmatter
  parts.push(generateFrontmatter(data.document, data.tags));
  parts.push("");

  // Content
  if (data.markdownContent) {
    parts.push(data.markdownContent);
  }

  // Highlights appendix
  const includeHighlights = options?.includeHighlights ?? true;
  const format = options?.highlightFormat ?? "appendix";

  if (includeHighlights && data.highlights.length > 0 && format === "appendix") {
    parts.push("");
    parts.push("## Highlights");
    parts.push("");

    for (const h of data.highlights) {
      parts.push(`> ${h.text}`);
      parts.push("");

      const meta: string[] = [];
      if (h.note && (options?.includeNotes ?? true)) {
        meta.push(`**Note:** ${h.note}`);
      }
      meta.push(`**Color:** ${colorName(h.color)}`);
      if (h.tags.length > 0) {
        meta.push(`**Tags:** ${h.tags.map((t) => `#${t.name}`).join(", ")}`);
      }
      parts.push(meta.join(" | "));
      parts.push("");
      parts.push("---");
      parts.push("");
    }
  }

  return parts.join("\n").trim() + "\n";
}

export function formatHighlightsAsMarkdown(
  highlights: HighlightWithDocument[]
): string {
  if (highlights.length === 0) return "";

  const parts: string[] = [];
  parts.push("# Highlights Export");
  parts.push("");

  // Group by document
  const grouped = new Map<
    string,
    { title: string; url?: string | null; highlights: HighlightWithDocument[] }
  >();

  for (const h of highlights) {
    const docId = h.document.id;
    if (!grouped.has(docId)) {
      grouped.set(docId, {
        title: h.document.title,
        url: h.document.url,
        highlights: [],
      });
    }
    grouped.get(docId)!.highlights.push(h);
  }

  for (const [, group] of grouped) {
    parts.push(`## ${group.title}`);
    if (group.url) {
      parts.push(`[Original](${group.url})`);
    }
    parts.push("");

    for (const h of group.highlights) {
      parts.push(`> ${h.text}`);
      parts.push("");
      const meta: string[] = [];
      if (h.note) meta.push(`**Note:** ${h.note}`);
      meta.push(`**Color:** ${colorName(h.color)}`);
      if (h.tags.length > 0) {
        meta.push(`**Tags:** ${h.tags.map((t) => `#${t.name}`).join(", ")}`);
      }
      if (meta.length > 0) {
        parts.push(meta.join(" | "));
        parts.push("");
      }
    }

    parts.push("---");
    parts.push("");
  }

  return parts.join("\n").trim() + "\n";
}

function colorName(hex: string): string {
  const map: Record<string, string> = {
    "#FFFF00": "Yellow",
    "#90EE90": "Green",
    "#87CEEB": "Blue",
    "#DDA0DD": "Purple",
    "#FF6B6B": "Red",
  };
  return map[hex] ?? hex;
}
