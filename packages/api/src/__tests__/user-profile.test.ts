import { describe, it, expect } from "vitest";
import { validateSlug, InvalidSlugError } from "../user-profile.js";

describe("validateSlug", () => {
  it("accepts a valid slug", () => {
    expect(() => validateSlug("alice")).not.toThrow();
  });

  it("accepts a slug with hyphens and numbers", () => {
    expect(() => validateSlug("my-team-42")).not.toThrow();
  });

  it("accepts exactly 3 characters", () => {
    expect(() => validateSlug("abc")).not.toThrow();
  });

  it("accepts exactly 30 characters", () => {
    expect(() => validateSlug("a".repeat(30))).not.toThrow();
  });

  it("throws InvalidSlugError for empty string", () => {
    expect(() => validateSlug("")).toThrow(InvalidSlugError);
    expect(() => validateSlug("")).toThrow("Slug is required");
  });

  it("throws InvalidSlugError for slug shorter than 3 characters", () => {
    expect(() => validateSlug("ab")).toThrow(InvalidSlugError);
    expect(() => validateSlug("ab")).toThrow("between 3 and 30");
  });

  it("throws InvalidSlugError for slug longer than 30 characters", () => {
    const long = "a".repeat(31);
    expect(() => validateSlug(long)).toThrow(InvalidSlugError);
    expect(() => validateSlug(long)).toThrow("between 3 and 30");
  });

  it("throws InvalidSlugError for slug with uppercase letters", () => {
    expect(() => validateSlug("Alice")).toThrow(InvalidSlugError);
  });

  it("throws InvalidSlugError for slug with spaces", () => {
    expect(() => validateSlug("owner team")).toThrow(InvalidSlugError);
  });

  it("throws InvalidSlugError for slug with special characters", () => {
    expect(() => validateSlug("hello!")).toThrow(InvalidSlugError);
  });
});
