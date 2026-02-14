"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SHORTCUT_GROUPS = [
  {
    title: "Navigation",
    shortcuts: [
      { key: "j / ↓", action: "Next document" },
      { key: "k / ↑", action: "Previous document" },
      { key: "Enter", action: "Open document" },
      { key: "Escape", action: "Back to list" },
    ],
  },
  {
    title: "Document Actions",
    shortcuts: [
      { key: "f", action: "Star / unstar" },
      { key: "Space", action: "Mark read / unread" },
      { key: "e", action: "Archive" },
      { key: "Shift+E", action: "Move to Inbox" },
      { key: "l", action: "Move to Later" },
      { key: "d", action: "Delete" },
      { key: "t", action: "Edit tags" },
      { key: "o", action: "Open original URL" },
      { key: "Shift+C", action: "Copy URL" },
    ],
  },
  {
    title: "Panel Controls",
    shortcuts: [
      { key: "[", action: "Toggle left panel" },
      { key: "]", action: "Toggle right panel" },
      { key: "Shift+H", action: "Toggle HTML / Markdown" },
    ],
  },
  {
    title: "Global",
    shortcuts: [
      { key: "a", action: "Add URL" },
      { key: "/", action: "Focus search" },
      { key: "?", action: "Show shortcuts" },
    ],
  },
];

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-2">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {group.title}
              </h3>
              <div className="space-y-1">
                {group.shortcuts.map((s) => (
                  <div
                    key={s.key}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-sm">{s.action}</span>
                    <kbd className="rounded border bg-muted px-2 py-0.5 text-xs font-mono">
                      {s.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
