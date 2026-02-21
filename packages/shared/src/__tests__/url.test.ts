import { describe, it, expect } from "vitest";
import { normalizeUrl, extractDomain } from "../url.js";

describe("normalizeUrl", () => {
  it("strips utm params", () => {
    expect(
      normalizeUrl(
        "https://example.com/article?utm_source=twitter&utm_medium=social"
      )
    ).toBe("https://example.com/article");
  });

  it("strips fbclid and gclid", () => {
    expect(
      normalizeUrl("https://example.com/page?fbclid=abc123&gclid=xyz456")
    ).toBe("https://example.com/page");
  });

  it("preserves www. prefix", () => {
    expect(normalizeUrl("https://www.example.com/page")).toBe(
      "https://www.example.com/page"
    );
  });

  it("removes trailing slash", () => {
    expect(normalizeUrl("https://example.com/page/")).toBe(
      "https://example.com/page"
    );
  });

  it("preserves root slash", () => {
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com/");
  });

  it("sorts remaining params", () => {
    expect(normalizeUrl("https://example.com/page?z=1&a=2")).toBe(
      "https://example.com/page?a=2&z=1"
    );
  });

  it("removes hash", () => {
    expect(normalizeUrl("https://example.com/page#section")).toBe(
      "https://example.com/page"
    );
  });

  it("returns invalid URLs unchanged", () => {
    expect(normalizeUrl("not a url")).toBe("not a url");
  });

  it("handles mixed tracking and non-tracking params", () => {
    expect(
      normalizeUrl("https://example.com/page?id=5&utm_source=twitter&sort=date")
    ).toBe("https://example.com/page?id=5&sort=date");
  });
});

describe("extractDomain", () => {
  it("extracts domain without www", () => {
    expect(extractDomain("https://www.example.com/page")).toBe("example.com");
  });

  it("extracts domain without www prefix", () => {
    expect(extractDomain("https://blog.example.com/page")).toBe(
      "blog.example.com"
    );
  });

  it("returns input for invalid URLs", () => {
    expect(extractDomain("not a url")).toBe("not a url");
  });
});
