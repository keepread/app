import { parseHTML } from "linkedom";
import { TRACKER_DOMAINS } from "@focus-reader/shared";

const ALLOWED_TAGS = new Set([
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "br", "hr",
  "ul", "ol", "li",
  "a", "img",
  "strong", "b", "em", "i", "u", "s", "del",
  "blockquote", "pre", "code",
  "thead", "tbody", "tr", "th", "td",
  "div", "span",
  "figure", "figcaption",
  "sup", "sub",
]);

// Table-related tags handled separately (layout vs data detection)
const TABLE_TAGS = new Set(["table", "thead", "tbody", "tr", "th", "td"]);

// Invisible characters used in email preheader padding
const INVISIBLE_CHARS_RE = /[\u200B\u200C\u200D\u034F\u00AD\u2060\uFEFF]/g;

const ALLOWED_ATTRS = new Set([
  "href", "src", "alt", "title", "width", "height",
  "class", "id", "style",
  "colspan", "rowspan",
  "target", "rel",
]);

const FORBIDDEN_ATTR_PREFIXES = ["on"]; // covers onerror, onclick, onload, etc.

// Tags that should be removed entirely with all their children
const DANGEROUS_TAGS = new Set([
  "script", "style", "iframe", "object", "embed", "form",
  "input", "textarea", "select", "button", "noscript",
  "template", "meta", "link", "base", "head",
]);

export function sanitizeHtml(html: string): string {
  const { document } = parseHTML(`<!DOCTYPE html><html><body>${html}</body></html>`);

  // Unwrap layout tables before general sanitization (so their content is preserved)
  unwrapLayoutTables(document.body);

  // Walk the DOM tree and remove forbidden elements and attributes
  sanitizeNode(document.body);

  // Strip tracking pixels
  stripTrackingPixels(document);

  // Strip invisible preheader characters from text nodes
  stripInvisibleChars(document.body);

  return document.body.innerHTML;
}

function sanitizeNode(node: any): void {
  // Repeat until stable (unwrapping may introduce new non-allowed children)
  let changed = true;
  while (changed) {
    changed = false;
    const children = Array.from(node.childNodes || []) as any[];

    for (const child of children) {
      if (child.nodeType !== 1) continue; // Keep text nodes as-is

      const tagName = child.tagName?.toLowerCase() || "";

      if (DANGEROUS_TAGS.has(tagName)) {
        child.remove();
        changed = true;
        continue;
      }

      if (!ALLOWED_TAGS.has(tagName) && !TABLE_TAGS.has(tagName)) {
        // Unwrap: promote children to parent, remove the wrapper
        const grandchildren = Array.from(child.childNodes || []) as any[];
        for (const gc of grandchildren) {
          node.insertBefore(gc, child);
        }
        child.remove();
        changed = true;
        continue;
      }

      // Remove forbidden attributes
      const attrs = Array.from(child.attributes || []) as any[];
      for (const attr of attrs) {
        const attrName = attr.name?.toLowerCase() || "";
        if (!ALLOWED_ATTRS.has(attrName)) {
          child.removeAttribute(attr.name);
          continue;
        }
        if (FORBIDDEN_ATTR_PREFIXES.some((p) => attrName.startsWith(p))) {
          child.removeAttribute(attr.name);
        }
      }

      // Recursively sanitize children
      sanitizeNode(child);
    }
  }
}

function isLayoutTable(table: any): boolean {
  // In email HTML, the only real data tables have <th> header cells.
  // Everything else — centering wrappers, button bars, spacer grids — is layout.
  return !table.querySelector("th");
}

function unwrapLayoutTables(root: any): void {
  // Process innermost tables first (querySelectorAll returns document order,
  // but we reverse so nested tables are handled before their parents)
  const tables = Array.from(root.querySelectorAll("table")).reverse() as any[];

  for (const table of tables) {
    if (isLayoutTable(table)) {
      unwrapElement(table);
    }
  }
}

function unwrapElement(el: any): void {
  const parent = el.parentNode;
  if (!parent) return;
  const children = Array.from(el.childNodes || []) as any[];
  for (const child of children) {
    parent.insertBefore(child, el);
  }
  el.remove();
}

function stripInvisibleChars(root: any): void {
  const walker = root.ownerDocument.createTreeWalker(
    root,
    4, // NodeFilter.SHOW_TEXT
  );

  const toRemove: any[] = [];
  let node = walker.nextNode();

  while (node) {
    const cleaned = node.textContent.replace(INVISIBLE_CHARS_RE, "");
    if (cleaned !== node.textContent) {
      if (cleaned.trim() === "") {
        toRemove.push(node);
      } else {
        node.textContent = cleaned;
      }
    }
    node = walker.nextNode();
  }

  for (const n of toRemove) {
    n.remove();
  }
}

function stripTrackingPixels(document: any): void {
  const images = Array.from(document.querySelectorAll("img")) as any[];

  for (const img of images) {
    const src = img.getAttribute("src") || "";
    const width = img.getAttribute("width");
    const height = img.getAttribute("height");

    if (width === "1" && height === "1") {
      img.remove();
      continue;
    }
    if (width === "0" || height === "0") {
      img.remove();
      continue;
    }

    if (isTrackerUrl(src)) {
      img.remove();
      continue;
    }
  }
}

function isTrackerUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return TRACKER_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith("." + domain)
    );
  } catch {
    return false;
  }
}

export function rewriteCidUrls(
  html: string,
  documentId: string,
  cidMap: Map<string, string>
): string {
  const { document } = parseHTML(`<!DOCTYPE html><html><body>${html}</body></html>`);
  const images = Array.from(document.querySelectorAll("img")) as any[];

  for (const img of images) {
    const src = img.getAttribute("src") || "";
    if (src.startsWith("cid:")) {
      const contentId = src.slice(4);
      if (cidMap.has(contentId)) {
        img.setAttribute(
          "src",
          `/api/attachments/${documentId}/${contentId}`
        );
      }
    }
  }

  return document.body.innerHTML;
}
