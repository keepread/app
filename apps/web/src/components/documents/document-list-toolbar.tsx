"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

interface DocumentListToolbarProps {
  title: string;
  total: number;
}

export function DocumentListToolbar({ title, total }: DocumentListToolbarProps) {
  return (
    <div className="flex items-center justify-between border-b px-4 py-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground">
            Date saved
            <ChevronDown className="size-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>Date saved</DropdownMenuItem>
          <DropdownMenuItem>Date published</DropdownMenuItem>
          <DropdownMenuItem>Title A-Z</DropdownMenuItem>
          <DropdownMenuItem>Reading time</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
