import { useState, useEffect, useMemo, useCallback } from "react";
import { getTags, createTag, type Tag } from "@/lib/api-client";

interface TagPickerProps {
  selectedIds: string[];
  onToggle: (tagId: string) => void;
  disabled?: boolean;
}

const RECENT_TAG_IDS_KEY = "recentTagIds";
const MAX_RECENT_TAGS = 8;

export function TagPicker({ selectedIds, onToggle, disabled = false }: TagPickerProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [recentTagIds, setRecentTagIds] = useState<string[]>([]);
  const [creatingTag, setCreatingTag] = useState(false);
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [allTags, storedRecent] = await Promise.all([
          getTags().catch(() => []),
          browser.storage.local.get([RECENT_TAG_IDS_KEY]),
        ]);
        setTags(allTags);
        const fromStorage = storedRecent[RECENT_TAG_IDS_KEY];
        if (Array.isArray(fromStorage)) {
          setRecentTagIds(fromStorage.filter((value): value is string => typeof value === "string"));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleTags = useMemo(
    () =>
      normalizedQuery.length === 0
        ? tags
        : tags.filter((tag) => tag.name.toLowerCase().includes(normalizedQuery)),
    [normalizedQuery, tags]
  );

  const recentTags = useMemo(() => {
    const visibleById = new Map(visibleTags.map((tag) => [tag.id, tag]));
    return recentTagIds
      .map((id) => visibleById.get(id))
      .filter((tag): tag is Tag => Boolean(tag));
  }, [recentTagIds, visibleTags]);

  const otherTags = useMemo(() => {
    if (recentTags.length === 0) return visibleTags;
    const recentSet = new Set(recentTags.map((tag) => tag.id));
    return visibleTags.filter((tag) => !recentSet.has(tag.id));
  }, [recentTags, visibleTags]);

  const updateRecentTagIds = useCallback((next: string[]) => {
    setRecentTagIds(next);
    browser.storage.local
      .set({ [RECENT_TAG_IDS_KEY]: next })
      .catch(() => {});
  }, []);

  const handleToggle = useCallback(
    (tagId: string) => {
      setCreateError("");
      const alreadySelected = selectedIds.includes(tagId);
      onToggle(tagId);
      if (!alreadySelected) {
        const next = [tagId, ...recentTagIds.filter((id) => id !== tagId)].slice(
          0,
          MAX_RECENT_TAGS
        );
        updateRecentTagIds(next);
      }
    },
    [onToggle, recentTagIds, selectedIds, updateRecentTagIds]
  );

  const existingExactTag = useMemo(
    () => tags.find((tag) => tag.name.toLowerCase() === normalizedQuery),
    [normalizedQuery, tags]
  );

  const canCreateTag = normalizedQuery.length > 0 && !existingExactTag;

  const handleCreateTag = useCallback(async () => {
    const name = query.trim();
    if (!name) return;

    const existing = tags.find((tag) => tag.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      handleToggle(existing.id);
      setQuery("");
      return;
    }

    setCreatingTag(true);
    setCreateError("");
    try {
      const created = await createTag({ name });
      setTags((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      handleToggle(created.id);
      setQuery("");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create tag.");
    } finally {
      setCreatingTag(false);
    }
  }, [handleToggle, query, tags]);

  if (loading) {
    return <div className="text-xs text-[var(--text-tertiary)] py-2">Loading tags...</div>;
  }

  if (tags.length === 0) {
    return <div className="text-xs text-[var(--text-tertiary)] py-2">No tags created yet.</div>;
  }

  return (
    <div className="mt-2 space-y-2">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search or create tag..."
        disabled={disabled || creatingTag}
        onKeyDown={(event) => {
          if (event.key === "Enter" && canCreateTag) {
            event.preventDefault();
            handleCreateTag().catch(() => {});
          }
        }}
        className="w-full px-2.5 py-1.5 text-xs rounded-md border border-[var(--border)] bg-[var(--bg-primary)] disabled:opacity-60"
      />

      {canCreateTag ? (
        <button
          type="button"
          disabled={disabled || creatingTag}
          onClick={() => handleCreateTag().catch(() => {})}
          className="w-full text-left px-2.5 py-1.5 text-xs rounded-md border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] disabled:opacity-60"
        >
          {creatingTag ? `Creating "${query.trim()}"...` : `Create tag "${query.trim()}"`}
        </button>
      ) : null}

      {createError ? (
        <p className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/20 rounded px-2 py-1">
          {createError}
        </p>
      ) : null}

      <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
        {recentTags.length > 0 ? (
          <div>
            <p className="text-[11px] text-[var(--text-tertiary)] mb-1">Recent</p>
            <div className="space-y-1">
              {recentTags.map((tag) => (
                <label
                  key={tag.id}
                  className="flex items-center gap-1.5 py-1 cursor-pointer text-xs"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(tag.id)}
                    onChange={() => handleToggle(tag.id)}
                    disabled={disabled}
                    className="rounded border-gray-300"
                  />
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color ?? "#888" }}
                  />
                  <span className="truncate">{tag.name}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {otherTags.length > 0 ? (
          <div>
            <p className="text-[11px] text-[var(--text-tertiary)] mb-1">
              {recentTags.length > 0 ? "All tags" : "Tags"}
            </p>
            <div className="space-y-1">
              {otherTags.map((tag) => (
                <label
                  key={tag.id}
                  className="flex items-center gap-1.5 py-1 cursor-pointer text-xs"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(tag.id)}
                    onChange={() => handleToggle(tag.id)}
                    disabled={disabled}
                    className="rounded border-gray-300"
                  />
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color ?? "#888" }}
                  />
                  <span className="truncate">{tag.name}</span>
                </label>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-[var(--text-tertiary)] py-1">No matching tags.</p>
        )}
      </div>
    </div>
  );
}
