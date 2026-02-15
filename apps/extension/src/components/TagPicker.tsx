import { useState, useEffect } from "react";
import { getTags, type Tag } from "@/lib/api-client";

interface TagPickerProps {
  selectedIds: string[];
  onToggle: (tagId: string) => void;
}

export function TagPicker({ selectedIds, onToggle }: TagPickerProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTags()
      .then(setTags)
      .catch(() => setTags([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-xs text-gray-400 py-2">Loading tags...</div>;
  if (tags.length === 0) return null;

  return (
    <div className="mt-2 max-h-36 overflow-y-auto">
      {tags.map((tag) => (
        <label
          key={tag.id}
          className="flex items-center gap-1.5 py-1 cursor-pointer text-sm"
        >
          <input
            type="checkbox"
            checked={selectedIds.includes(tag.id)}
            onChange={() => onToggle(tag.id)}
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
  );
}
