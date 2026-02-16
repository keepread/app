"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

const PRESET_COLORS = [
  "#6366f1", // indigo (default)
  "#ec4899", // pink
  "#f59e0b", // amber
  "#10b981", // emerald
  "#06b6d4", // cyan
  "#8b5cf6", // violet
  "#ef4444", // red
  "#f97316", // orange
];

interface ColorPickerProps {
  value: string | null;
  onChange: (color: string) => void;
  onClose?: () => void;
}

export function ColorPicker({ value, onChange, onClose }: ColorPickerProps) {
  const [customColor, setCustomColor] = useState(value || "#6366f1");
  const currentColor = value || "#6366f1";

  const handlePresetClick = (color: string) => {
    onChange(color);
    onClose?.();
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    setCustomColor(color);
    onChange(color);
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">
          Preset Colors
        </p>
        <div className="grid grid-cols-4 gap-2">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              className="size-8 rounded-md flex items-center justify-center hover:ring-2 hover:ring-offset-2 hover:ring-primary/50 transition-all"
              style={{ backgroundColor: color }}
              onClick={() => handlePresetClick(color)}
              aria-label={`Select ${color}`}
            >
              {currentColor.toLowerCase() === color.toLowerCase() && (
                <Check className="size-4 text-white" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">
          Custom Color
        </p>
        <div className="flex items-center gap-2">
          <Input
            type="color"
            value={customColor}
            onChange={handleCustomChange}
            className="h-8 w-16 p-1 cursor-pointer"
          />
          <Input
            type="text"
            value={customColor}
            onChange={(e) => {
              const color = e.target.value;
              setCustomColor(color);
              if (/^#[0-9A-F]{6}$/i.test(color)) {
                onChange(color);
              }
            }}
            placeholder="#6366f1"
            className="h-8 flex-1 font-mono text-xs"
          />
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={onClose}
      >
        Done
      </Button>
    </div>
  );
}
