"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useApp } from "@/contexts/app-context";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Inbox,
  Clock,
  Archive,
  Star,
  Library,
  Plus,
  Settings,
  Sun,
  Moon,
  Maximize2,
  Search,
  Keyboard,
} from "lucide-react";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddBookmark: () => void;
  onShowShortcuts?: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  onAddBookmark,
  onShowShortcuts,
}: CommandPaletteProps) {
  const router = useRouter();
  const { setTheme, theme } = useTheme();
  const { toggleFocusMode } = useApp();

  const runCommand = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runCommand(() => router.push("/"))}>
            <Inbox className="mr-2" />
            Inbox
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/later"))}>
            <Clock className="mr-2" />
            Later
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/archive"))}>
            <Archive className="mr-2" />
            Archive
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/starred"))}>
            <Star className="mr-2" />
            Starred
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/all"))}>
            <Library className="mr-2" />
            All Documents
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() =>
              runCommand(() => {
                const searchInput = document.querySelector<HTMLInputElement>(
                  'input[type="search"], input[placeholder*="earch"]'
                );
                if (searchInput) searchInput.focus();
              })
            }
          >
            <Search className="mr-2" />
            Search Documents
            <CommandShortcut>/</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(onAddBookmark)}>
            <Plus className="mr-2" />
            Add URL
            <CommandShortcut>A</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(toggleFocusMode)}>
            <Maximize2 className="mr-2" />
            Toggle Focus Mode
            <CommandShortcut>F</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runCommand(() => {
                if (theme === "dark") setTheme("light");
                else if (theme === "light") setTheme("system");
                else setTheme("dark");
              })
            }
          >
            {theme === "dark" ? <Sun className="mr-2" /> : <Moon className="mr-2" />}
            Toggle Theme
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Settings">
          <CommandItem onSelect={() => runCommand(() => router.push("/settings"))}>
            <Settings className="mr-2" />
            Open Settings
          </CommandItem>
          {onShowShortcuts && (
            <CommandItem onSelect={() => runCommand(onShowShortcuts)}>
              <Keyboard className="mr-2" />
              Keyboard Shortcuts
              <CommandShortcut>?</CommandShortcut>
            </CommandItem>
          )}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
