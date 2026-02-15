import { XMLParser } from "fast-xml-parser";

export interface FeedItem {
  guid: string;
  title: string;
  url: string;
  author: string | null;
  contentHtml: string | null;
  contentText: string | null;
  excerpt: string | null;
  publishedAt: string | null;
  coverImageUrl: string | null;
}

export interface ParsedFeed {
  title: string;
  description: string | null;
  siteUrl: string | null;
  iconUrl: string | null;
  items: FeedItem[];
}

interface JsonFeedItem {
  id?: string;
  url?: string;
  title?: string;
  content_html?: string;
  content_text?: string;
  summary?: string;
  date_published?: string;
  date_modified?: string;
  author?: { name?: string } | { name?: string }[];
  authors?: { name?: string }[];
  image?: string;
  banner_image?: string;
}

interface JsonFeed {
  version: string;
  title?: string;
  description?: string;
  home_page_url?: string;
  feed_url?: string;
  icon?: string;
  favicon?: string;
  items?: JsonFeedItem[];
}

function tryParseJson(text: string): JsonFeed | null {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null && typeof parsed.version === "string" && parsed.version.startsWith("https://jsonfeed.org/")) {
      return parsed as JsonFeed;
    }
  } catch {
    // Not JSON
  }
  return null;
}

function safeString(val: unknown): string | null {
  if (val == null) return null;
  if (typeof val === "string") return val || null;
  if (typeof val === "object" && "#text" in (val as Record<string, unknown>)) {
    return safeString((val as Record<string, unknown>)["#text"]);
  }
  return String(val) || null;
}

function safeDate(val: unknown): string | null {
  if (val == null) return null;
  const str = typeof val === "string" ? val : String(val);
  try {
    const d = new Date(str);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

function extractCoverImage(item: Record<string, unknown>): string | null {
  // media:content
  const mediaContent = item["media:content"];
  if (mediaContent) {
    const mc = Array.isArray(mediaContent) ? mediaContent[0] : mediaContent;
    if (mc && typeof mc === "object") {
      const attrs = mc as Record<string, unknown>;
      const url = attrs["@_url"];
      const medium = attrs["@_medium"];
      const type = safeString(attrs["@_type"]);
      if (url && (medium === "image" || !type || type.startsWith("image/"))) {
        return safeString(url);
      }
    }
  }

  // media:thumbnail
  const mediaThumbnail = item["media:thumbnail"];
  if (mediaThumbnail) {
    const mt = Array.isArray(mediaThumbnail) ? mediaThumbnail[0] : mediaThumbnail;
    if (mt && typeof mt === "object") {
      const url = (mt as Record<string, unknown>)["@_url"];
      if (url) return safeString(url);
    }
  }

  // enclosure with image type
  const enclosure = item["enclosure"];
  if (enclosure) {
    const enc = Array.isArray(enclosure) ? enclosure[0] : enclosure;
    if (enc && typeof enc === "object") {
      const attrs = enc as Record<string, unknown>;
      const type = safeString(attrs["@_type"]);
      if (type && type.startsWith("image/")) {
        return safeString(attrs["@_url"]);
      }
    }
  }

  return null;
}

function ensureArray<T>(val: T | T[] | undefined | null): T[] {
  if (val == null) return [];
  return Array.isArray(val) ? val : [val];
}

function parseRss2Items(channel: Record<string, unknown>, feedUrl: string): FeedItem[] {
  const rawItems = ensureArray(channel["item"] as Record<string, unknown> | Record<string, unknown>[]);
  return rawItems.map((item) => {
    const link = safeString(item["link"]);
    const guidVal = item["guid"];
    let guid: string;
    if (guidVal && typeof guidVal === "object" && "#text" in (guidVal as Record<string, unknown>)) {
      guid = String((guidVal as Record<string, unknown>)["#text"]);
    } else if (guidVal != null) {
      guid = String(guidVal);
    } else {
      guid = link || crypto.randomUUID();
    }

    const contentEncoded = safeString(item["content:encoded"]);
    const content = safeString(item["content"]);
    const description = safeString(item["description"]);
    const contentHtml = contentEncoded || content || description || null;

    const authorStr = safeString(item["author"]) || safeString(item["dc:creator"]);

    return {
      guid,
      title: safeString(item["title"]) || "",
      url: link || "",
      author: authorStr,
      contentHtml,
      contentText: null,
      excerpt: description && description !== contentHtml ? description : null,
      publishedAt: safeDate(item["pubDate"]) || safeDate(item["dc:date"]),
      coverImageUrl: extractCoverImage(item),
    };
  });
}

function parseAtomItems(feed: Record<string, unknown>, feedUrl: string): FeedItem[] {
  const entries = ensureArray(feed["entry"] as Record<string, unknown> | Record<string, unknown>[]);
  return entries.map((entry) => {
    const links = ensureArray(entry["link"] as Record<string, unknown> | Record<string, unknown>[]);
    let url = "";
    for (const link of links) {
      if (typeof link === "object" && link !== null) {
        const rel = safeString(link["@_rel"]);
        if (rel === "alternate" || !rel) {
          url = safeString(link["@_href"]) || "";
          break;
        }
      } else if (typeof link === "string") {
        url = link;
        break;
      }
    }
    if (!url && links.length > 0) {
      const first = links[0];
      if (typeof first === "object" && first !== null) {
        url = safeString(first["@_href"]) || "";
      }
    }

    const id = safeString(entry["id"]) || url || crypto.randomUUID();

    // Content handling
    const contentNode = entry["content"];
    let contentHtml: string | null = null;
    if (contentNode && typeof contentNode === "object" && "#text" in (contentNode as Record<string, unknown>)) {
      contentHtml = safeString((contentNode as Record<string, unknown>)["#text"]);
    } else {
      contentHtml = safeString(contentNode);
    }

    const summaryNode = entry["summary"];
    let summary: string | null = null;
    if (summaryNode && typeof summaryNode === "object" && "#text" in (summaryNode as Record<string, unknown>)) {
      summary = safeString((summaryNode as Record<string, unknown>)["#text"]);
    } else {
      summary = safeString(summaryNode);
    }

    if (!contentHtml) {
      contentHtml = summary;
    }

    // Author
    const authorNode = entry["author"];
    let author: string | null = null;
    if (authorNode && typeof authorNode === "object") {
      author = safeString((authorNode as Record<string, unknown>)["name"]);
    } else {
      author = safeString(authorNode);
    }

    return {
      guid: id,
      title: safeString(entry["title"]) || "",
      url,
      author,
      contentHtml,
      contentText: null,
      excerpt: summary && summary !== contentHtml ? summary : null,
      publishedAt: safeDate(entry["published"]) || safeDate(entry["updated"]),
      coverImageUrl: extractCoverImage(entry),
    };
  });
}

function parseJsonFeed(json: JsonFeed): ParsedFeed {
  const items: FeedItem[] = (json.items || []).map((item) => {
    let author: string | null = null;
    if (item.authors && item.authors.length > 0) {
      author = item.authors[0].name || null;
    } else if (item.author) {
      if (Array.isArray(item.author)) {
        author = item.author[0]?.name || null;
      } else {
        author = item.author.name || null;
      }
    }

    return {
      guid: item.id || item.url || crypto.randomUUID(),
      title: item.title || "",
      url: item.url || "",
      author,
      contentHtml: item.content_html || null,
      contentText: item.content_text || null,
      excerpt: item.summary || null,
      publishedAt: safeDate(item.date_published),
      coverImageUrl: item.image || item.banner_image || null,
    };
  });

  return {
    title: json.title || "",
    description: json.description || null,
    siteUrl: json.home_page_url || null,
    iconUrl: json.icon || json.favicon || null,
    items,
  };
}

export function parseFeedXml(xml: string, feedUrl: string): ParsedFeed {
  // Try JSON Feed first
  const jsonFeed = tryParseJson(xml);
  if (jsonFeed) {
    return parseJsonFeed(jsonFeed);
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    isArray: (name) => name === "item" || name === "entry" || name === "link",
  });

  const doc = parser.parse(xml);

  // RSS 2.0
  if (doc.rss) {
    const channel = doc.rss.channel || {};
    const siteLink = channel.link;
    let siteUrl: string | null = null;
    if (Array.isArray(siteLink)) {
      for (const l of siteLink) {
        if (typeof l === "string") { siteUrl = l; break; }
      }
    } else {
      siteUrl = safeString(siteLink);
    }

    return {
      title: safeString(channel.title) || "",
      description: safeString(channel.description),
      siteUrl,
      iconUrl: safeString(channel.image?.url),
      items: parseRss2Items(channel, feedUrl),
    };
  }

  // Atom 1.0
  if (doc.feed) {
    const feed = doc.feed;
    const links = ensureArray(feed.link as Record<string, unknown> | Record<string, unknown>[]);
    let siteUrl: string | null = null;
    for (const link of links) {
      if (typeof link === "object" && link !== null) {
        const rel = safeString(link["@_rel"]);
        if (rel === "alternate" || !rel) {
          siteUrl = safeString(link["@_href"]);
          break;
        }
      }
    }

    return {
      title: safeString(feed.title) || "",
      description: safeString(feed.subtitle),
      siteUrl,
      iconUrl: safeString(feed.icon) || safeString(feed.logo),
      items: parseAtomItems(feed, feedUrl),
    };
  }

  throw new Error("Unrecognized feed format");
}

export async function fetchFeed(url: string): Promise<ParsedFeed> {
  const response = await fetch(url, {
    headers: { "Accept": "application/rss+xml, application/atom+xml, application/feed+json, application/xml, text/xml, */*" },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch feed: ${response.status} ${response.statusText}`);
  }
  const text = await response.text();
  return parseFeedXml(text, url);
}

export function discoverFeedUrl(html: string, pageUrl: string): string | null {
  const pattern = /<link[^>]+rel=["']alternate["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const tag = match[0];
    const typeMatch = tag.match(/type=["']([^"']+)["']/i);
    if (!typeMatch) continue;
    const type = typeMatch[1].toLowerCase();
    if (
      type === "application/rss+xml" ||
      type === "application/atom+xml" ||
      type === "application/feed+json"
    ) {
      const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
      if (hrefMatch) {
        try {
          return new URL(hrefMatch[1], pageUrl).href;
        } catch {
          return hrefMatch[1];
        }
      }
    }
  }
  return null;
}
