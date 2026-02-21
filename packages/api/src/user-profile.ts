import type { UserScopedDb } from "@focus-reader/db";
import {
  getCurrentUser,
  getUserBySlugForOtherUser,
  updateCurrentUserSlugAndOnboarding,
} from "@focus-reader/db";
import { normalizeSlugInput } from "@focus-reader/shared";
import type { User } from "@focus-reader/shared";

const SLUG_PATTERN = /^[a-z0-9-]+$/;
const MIN_SLUG_LENGTH = 3;
const MAX_SLUG_LENGTH = 30;

export class InvalidSlugError extends Error {
  constructor(message = "Slug must be 3-30 characters and contain only lowercase letters, numbers, and hyphens") {
    super(message);
    this.name = "InvalidSlugError";
  }
}

export class SlugTakenError extends Error {
  constructor(message = "That slug is already in use") {
    super(message);
    this.name = "SlugTakenError";
  }
}

export function validateSlug(slug: string): void {
  if (!slug) {
    throw new InvalidSlugError("Slug is required");
  }
  if (slug.length < MIN_SLUG_LENGTH || slug.length > MAX_SLUG_LENGTH) {
    throw new InvalidSlugError("Slug must be between 3 and 30 characters");
  }
  if (!SLUG_PATTERN.test(slug)) {
    throw new InvalidSlugError("Slug can only contain lowercase letters, numbers, and hyphens");
  }
}

export async function completeUserOnboarding(
  ctx: UserScopedDb,
  slugInput: string
): Promise<User> {
  const slug = normalizeSlugInput(slugInput);
  validateSlug(slug);

  const conflict = await getUserBySlugForOtherUser(ctx, slug);
  if (conflict) {
    throw new SlugTakenError();
  }

  try {
    await updateCurrentUserSlugAndOnboarding(ctx, slug);
  } catch (err) {
    // D1/SQLite UNIQUE constraint failure → turn into a typed SlugTakenError
    // so concurrent writes get a 409 rather than a 500.
    if (err instanceof Error && err.message.includes("UNIQUE constraint failed")) {
      throw new SlugTakenError();
    }
    throw err;
  }

  const user = await getCurrentUser(ctx);
  if (!user) {
    throw new Error("Authenticated user not found");
  }

  return user;
}
