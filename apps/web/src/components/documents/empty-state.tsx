"use client";

import type { DocumentLocation } from "@focus-reader/shared";
import { Inbox, Clock, Archive, Star, SearchX } from "lucide-react";

const STATES: Record<
  string,
  { icon: typeof Inbox; message: string; action: string }
> = {
  inbox: {
    icon: Inbox,
    message: "Your inbox is empty",
    action: "Add an article or subscribe to a newsletter",
  },
  later: {
    icon: Clock,
    message: "Nothing saved for later",
    action: "Move documents here when you want to read them soon",
  },
  archive: {
    icon: Archive,
    message: "Archive is empty",
    action: "Documents you've finished reading will appear here",
  },
  starred: {
    icon: Star,
    message: "No starred documents",
    action: "Star important documents to find them quickly",
  },
  search: {
    icon: SearchX,
    message: "No documents found",
    action: "Try different filters",
  },
};

interface EmptyStateProps {
  location?: DocumentLocation;
  isStarred?: boolean;
}

export function EmptyState({ location, isStarred }: EmptyStateProps) {
  const key = isStarred ? "starred" : location || "inbox";
  const state = STATES[key] || STATES.inbox;
  const Icon = state.icon;

  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center px-4">
      <Icon className="size-12 text-muted-foreground/30 mb-4" />
      <p className="text-sm text-muted-foreground">{state.message}</p>
      <p className="text-xs text-muted-foreground mt-1">{state.action}</p>
    </div>
  );
}
