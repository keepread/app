"use client";

import { useEffect, useCallback } from "react";

type ShortcutHandler = () => void;

interface ShortcutMap {
  [key: string]: ShortcutHandler;
}

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    (el as HTMLElement).isContentEditable
  );
}

function getShortcutKey(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.metaKey) parts.push("Meta");
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");

  let key = e.key;
  // Normalize special keys
  if (key === " ") key = "Space";
  if (key === "ArrowDown") key = "ArrowDown";
  if (key === "ArrowUp") key = "ArrowUp";
  if (key === "Escape") key = "Escape";
  if (key === "Enter") key = "Enter";
  if (key === "Tab") key = "Tab";

  // Don't include modifier as key if it's already in parts
  if (!["Shift", "Control", "Alt", "Meta"].includes(key)) {
    parts.push(key);
  }

  return parts.join("+");
}

export function useKeyboardShortcuts(shortcuts: ShortcutMap) {
  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (isInputFocused()) return;

      const key = getShortcutKey(e);

      // Check the full combo first, then just the key
      const fn = shortcuts[key] || shortcuts[e.key];
      if (fn) {
        e.preventDefault();
        fn();
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handler]);
}
