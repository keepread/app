"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useApp } from "@/contexts/app-context";
import { cn } from "@/lib/utils";

interface TocItem {
  id: string;
  title: string;
  level: number;
}

interface ReaderTocProps {
  documentId: string;
}

export function ReaderToc({ documentId }: ReaderTocProps) {
  const { tocVisible } = useApp();
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Extract headings from rendered content
  useEffect(() => {
    // Wait for content to render
    const timer = setTimeout(() => {
      const headings = document.querySelectorAll(
        "article h1, article h2, article h3, article h4"
      );
      const tocItems: TocItem[] = [];
      headings.forEach((heading, index) => {
        const id = heading.id || `heading-${index}`;
        if (!heading.id) heading.id = id;
        tocItems.push({
          id,
          title: heading.textContent || "",
          level: parseInt(heading.tagName.charAt(1)),
        });
      });
      setItems(tocItems);
    }, 500);
    return () => clearTimeout(timer);
  }, [documentId]);

  // Track active heading with IntersectionObserver
  useEffect(() => {
    if (items.length === 0) return;
    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter(Boolean) as HTMLElement[];

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-10% 0px -80% 0px", threshold: 0 }
    );

    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [items]);

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  if (!tocVisible || items.length === 0) return null;

  return (
    <aside className="flex h-full w-[220px] flex-shrink-0 flex-col border-r overflow-y-auto">
      <nav className="flex flex-col gap-0.5 py-4 pr-4 pl-5">
        <h2 className="mb-2 text-sm font-semibold text-foreground">
          Contents
        </h2>
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => scrollTo(item.id)}
            className={cn(
              "text-left text-xs leading-relaxed transition-colors rounded-sm px-2 py-1",
              item.level === 2 && "pl-6",
              item.level === 3 && "pl-9",
              item.level >= 4 && "pl-12",
              activeId === item.id
                ? "text-primary font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.title}
          </button>
        ))}
      </nav>
    </aside>
  );
}
