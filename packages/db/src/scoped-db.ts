/**
 * User-scoped database wrapper.
 * Every query function that operates on user-owned data takes this instead of
 * raw D1Database, so the TypeScript compiler catches any callsite that forgets
 * to scope by user.
 */
export interface UserScopedDb {
  readonly db: D1Database;
  readonly userId: string;
}

export function scopeDb(db: D1Database, userId: string): UserScopedDb {
  return { db, userId };
}
