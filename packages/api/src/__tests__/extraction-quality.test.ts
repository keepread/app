import { describe, it, expect } from "vitest";
import { scoreExtraction, shouldEnrich, isImprovement } from "../extraction-quality.js";
import type { ExtractionScoreInput } from "../extraction-quality.js";

const fullArticle: ExtractionScoreInput = {
  title: "A Comprehensive Guide to Modern Web Development",
  url: "https://example.com/article",
  htmlContent: "<p>".padEnd(3000, "x"),
  plainTextContent: "x".repeat(1000),
  author: "Jane Doe",
  siteName: "Example Blog",
  publishedDate: "2024-06-01T12:00:00Z",
  coverImageUrl: "https://example.com/hero.jpg",
  excerpt: "This comprehensive guide covers all aspects of modern web development including frameworks and tooling.",
  wordCount: 500,
};

const bareBookmark: ExtractionScoreInput = {
  title: "https://example.com/page",
  url: "https://example.com/page",
  htmlContent: null,
  plainTextContent: null,
  author: null,
  siteName: null,
  publishedDate: null,
  coverImageUrl: null,
  excerpt: null,
  wordCount: 0,
};

const metadataOnly: ExtractionScoreInput = {
  title: "Page Title",
  url: "https://example.com/page",
  htmlContent: null,
  plainTextContent: null,
  author: "Author Name",
  siteName: "Site Name",
  publishedDate: null,
  coverImageUrl: "https://example.com/image.jpg",
  excerpt: "A short description of the page content.",
  wordCount: 0,
};

describe("scoreExtraction", () => {
  it("scores a full article above the enrichment threshold", () => {
    const score = scoreExtraction(fullArticle);
    expect(score).toBeGreaterThan(55);
  });

  it("scores a bare bookmark below the enrichment threshold", () => {
    const score = scoreExtraction(bareBookmark);
    expect(score).toBeLessThan(55);
  });

  it("scores a metadata-only bookmark in the middle range", () => {
    const score = scoreExtraction(metadataOnly);
    expect(score).toBeGreaterThan(20);
    expect(score).toBeLessThan(55);
  });

  it("caps score at 100", () => {
    const score = scoreExtraction(fullArticle);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe("shouldEnrich", () => {
  it("returns false when score is above threshold", () => {
    expect(shouldEnrich(60)).toBe(false);
  });

  it("returns true when score is below threshold", () => {
    expect(shouldEnrich(40)).toBe(true);
  });

  it("returns false when hasUrl is false regardless of score", () => {
    expect(shouldEnrich(10, { hasUrl: false })).toBe(false);
  });

  it("respects custom threshold", () => {
    expect(shouldEnrich(60, { threshold: 70 })).toBe(true);
    expect(shouldEnrich(60, { threshold: 50 })).toBe(false);
  });
});

describe("isImprovement", () => {
  it("returns true when new score exceeds old by 10+", () => {
    expect(isImprovement(40, 55, true, true)).toBe(true);
  });

  it("returns false when new score only marginally better", () => {
    expect(isImprovement(40, 45, true, true)).toBe(false);
  });

  it("returns true when old content missing but new content present", () => {
    expect(isImprovement(30, 35, false, true)).toBe(true);
  });

  it("returns false when neither content present nor score improved enough", () => {
    expect(isImprovement(30, 35, false, false)).toBe(false);
  });
});
