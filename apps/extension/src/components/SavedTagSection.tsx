import { useState } from "react";
import { type Tag } from "@/lib/api-client";
import { TagPicker } from "@/components/TagPicker";

interface SavedTagSectionProps {
  doc: { tags: Tag[] };
  onToggleTag: (tag: Tag) => void;
  onDone: () => void;
  disabled: boolean;
  label?: string;
}

export function SavedTagSection({
  doc,
  onToggleTag,
  onDone,
  disabled,
  label = "Tags",
}: SavedTagSectionProps) {
  const [showEditor, setShowEditor] = useState(false);

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-[var(--text-secondary)]">
          {label}
        </span>
        <button
          disabled={disabled}
          className="text-xs px-2 py-1 rounded-md border border-[var(--border)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
          onClick={() => {
            if (showEditor) {
              onDone();
            }
            setShowEditor((prev) => !prev);
          }}
        >
          {showEditor ? "Done" : "Edit tags"}
        </button>
      </div>

      {doc.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {doc.tags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-[var(--border)]"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: tag.color ?? "#888" }}
              />
              {tag.name}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[var(--text-tertiary)]">No tags yet.</p>
      )}

      {showEditor ? (
        <div className="mt-2">
          <TagPicker
            selectedIds={doc.tags.map((tag) => tag.id)}
            onToggle={onToggleTag}
            disabled={disabled}
          />
        </div>
      ) : null}
    </div>
  );
}
