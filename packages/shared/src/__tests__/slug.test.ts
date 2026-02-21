import { describe, it, expect } from "vitest";
import {
  normalizeSlugInput,
  slugToDisplayName,
  emailToSubscriptionKey,
} from "../slug.js";

describe("normalizeSlugInput", () => {
  it("trims whitespace", () => {
    expect(normalizeSlugInput("  alice  ")).toBe("alice");
  });

  it("lowercases input", () => {
    expect(normalizeSlugInput("Alice")).toBe("alice");
  });

  it("replaces spaces with hyphens", () => {
    expect(normalizeSlugInput("Owner Team")).toBe("owner-team");
  });

  it("collapses multiple separators into one hyphen", () => {
    expect(normalizeSlugInput("foo  bar")).toBe("foo-bar");
  });

  it("strips leading and trailing hyphens", () => {
    expect(normalizeSlugInput("-foo-")).toBe("foo");
  });

  it("replaces non-alphanumeric characters with hyphens", () => {
    expect(normalizeSlugInput("hello_world!")).toBe("hello-world");
  });

  it("returns empty string for all-symbol input", () => {
    expect(normalizeSlugInput("---")).toBe("");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(normalizeSlugInput("   ")).toBe("");
  });
});

describe("slugToDisplayName", () => {
  it("converts hyphenated slug", () => {
    expect(slugToDisplayName("morning-brew")).toBe("Morning Brew");
  });

  it("converts underscored slug", () => {
    expect(slugToDisplayName("tech_weekly")).toBe("Tech Weekly");
  });

  it("converts plus-separated slug", () => {
    expect(slugToDisplayName("tech+ai")).toBe("Tech Ai");
  });

  it("handles single word", () => {
    expect(slugToDisplayName("newsletter")).toBe("Newsletter");
  });

  it("handles mixed separators", () => {
    expect(slugToDisplayName("my-tech_news")).toBe("My Tech News");
  });
});

describe("emailToSubscriptionKey", () => {
  it("extracts local part", () => {
    expect(
      emailToSubscriptionKey("morning-brew@read.example.com", false)
    ).toBe("morning-brew");
  });

  it("lowercases the local part", () => {
    expect(
      emailToSubscriptionKey("Morning-Brew@read.example.com", false)
    ).toBe("morning-brew");
  });

  it("preserves plus suffix when collapsePlus is false", () => {
    expect(emailToSubscriptionKey("tech+ai@read.example.com", false)).toBe(
      "tech+ai"
    );
  });

  it("collapses plus suffix when collapsePlus is true", () => {
    expect(emailToSubscriptionKey("tech+ai@read.example.com", true)).toBe(
      "tech"
    );
  });

  it("handles no plus with collapsePlus true", () => {
    expect(
      emailToSubscriptionKey("morning-brew@read.example.com", true)
    ).toBe("morning-brew");
  });
});
