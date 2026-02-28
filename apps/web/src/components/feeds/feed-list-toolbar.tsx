"use client";

import { Button } from "@/components/ui/button";
import { PanelLeftOpen, PanelRightOpen } from "lucide-react";
import { SearchBar } from "@/components/search/search-bar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useApp } from "@/contexts/app-context";

interface FeedListToolbarProps {
  title: string;
  total: number;
  onSearch: (query: string) => void;
}

export function FeedListToolbar({ title, total, onSearch }: FeedListToolbarProps) {
  const { sidebarCollapsed, toggleSidebar, rightPanelVisible, toggleRightPanel } = useApp();

  return (
    <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
      <div className="flex items-center gap-1 shrink-0">
        {sidebarCollapsed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7" onClick={toggleSidebar}>
                <PanelLeftOpen className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <span>Show left panel</span>
              <kbd className="ml-2 rounded border bg-muted px-1 py-0.5 text-[10px] font-mono">[</kbd>
            </TooltipContent>
          </Tooltip>
        )}
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground ml-1">
          ({total})
        </span>
      </div>
      <div className="flex items-center gap-2">
        <SearchBar onSearch={onSearch} />
        {!rightPanelVisible && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7" onClick={toggleRightPanel}>
                <PanelRightOpen className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <span>Show right panel</span>
              <kbd className="ml-2 rounded border bg-muted px-1 py-0.5 text-[10px] font-mono">]</kbd>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
