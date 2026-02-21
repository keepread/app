export interface ExtractionScoreInput {
  title: string | null;
  url: string | null;
  htmlContent: string | null;
  plainTextContent: string | null;
  author: string | null;
  siteName: string | null;
  publishedDate: string | null;
  coverImageUrl: string | null;
  excerpt: string | null;
  wordCount: number;
  /** False when Readability failed and htmlContent is raw page HTML (JS-shell bias guard) */
  readabilitySucceeded?: boolean;
}

export interface EnrichmentIntent {
  documentId: string;
  userId: string;
  url: string;
  source: "manual_url" | "rss_full_content";
  score: number;
}

export function scoreExtraction(input: ExtractionScoreInput): number {
  let score = 0;

  // Title quality: 0-15
  if (input.title && input.title !== input.url) {
    score += input.title.length > 10 ? 15 : input.title.length > 3 ? 10 : 5;
  }

  // Content availability/size: 0-35
  // Only trust htmlContent length when Readability succeeded; fallback raw HTML
  // is a full JS-shell page and size does not reflect readable content quality.
  if (input.htmlContent && input.readabilitySucceeded !== false) {
    const len = input.htmlContent.length;
    if (len > 2000) score += 35;
    else if (len > 500) score += 25;
    else if (len > 100) score += 15;
    else score += 5;
  } else if (input.htmlContent && input.readabilitySucceeded === false) {
    // Readability failed — award minimal points just for having some content
    score += 5;
  }

  // Metadata completeness: 0-30 (6 points each)
  if (input.author) score += 6;
  if (input.siteName) score += 6;
  if (input.publishedDate) score += 6;
  if (input.coverImageUrl) score += 6;
  if (input.excerpt && input.excerpt.length > 20) score += 6;

  // Readability signals: 0-20
  if (input.wordCount > 200) score += 10;
  else if (input.wordCount > 50) score += 5;
  if (input.excerpt && input.excerpt.length > 50) score += 5;
  if (input.plainTextContent && input.plainTextContent.length > 500) score += 5;

  return Math.min(100, score);
}

const DEFAULT_THRESHOLD = 55;

export function shouldEnrich(
  score: number,
  hints?: { threshold?: number; hasUrl?: boolean }
): boolean {
  if (hints?.hasUrl === false) return false;
  const threshold = hints?.threshold ?? DEFAULT_THRESHOLD;
  return score < threshold;
}

export function isImprovement(
  oldScore: number,
  newScore: number,
  oldContentPresent: boolean,
  newContentPresent: boolean
): boolean {
  if (!oldContentPresent && newContentPresent) return true;
  return newScore >= oldScore + 10;
}
