"use client";

import { usePreferences } from "@/hooks/use-preferences";
import {
  FONT_FAMILIES,
  FONT_SIZE_RANGE,
  LINE_HEIGHT_RANGE,
  CONTENT_WIDTH_RANGE,
} from "@focus-reader/shared";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Type, Minus, Plus, RotateCcw } from "lucide-react";

export function ReaderPreferencesPopover() {
  const { preferences, updatePreference, fontSize, lineHeight, contentWidth } =
    usePreferences();

  const currentFontFamily = preferences?.font_family ?? "system";

  const adjustValue = (
    field: "font_size" | "line_height" | "content_width",
    current: number,
    range: { min: number; max: number; step: number },
    direction: 1 | -1
  ) => {
    const next = Math.round((current + range.step * direction) * 10) / 10;
    if (next >= range.min && next <= range.max) {
      updatePreference({ [field]: next });
    }
  };

  const handleReset = () => {
    updatePreference({
      font_family: null,
      font_size: null,
      line_height: null,
      content_width: null,
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8">
          <Type className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <div className="space-y-4">
          {/* Font family */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Font
            </label>
            <div className="grid grid-cols-2 gap-1 mt-1">
              {FONT_FAMILIES.map((f) => (
                <button
                  key={f.value}
                  onClick={() => updatePreference({ font_family: f.value })}
                  className={`rounded px-2 py-1 text-xs transition-colors ${
                    currentFontFamily === f.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                  style={{ fontFamily: f.css }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Font size */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Size
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={() =>
                  adjustValue("font_size", fontSize, FONT_SIZE_RANGE, -1)
                }
                disabled={fontSize <= FONT_SIZE_RANGE.min}
              >
                <Minus className="size-3" />
              </Button>
              <span className="w-8 text-center text-xs">{fontSize}</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={() =>
                  adjustValue("font_size", fontSize, FONT_SIZE_RANGE, 1)
                }
                disabled={fontSize >= FONT_SIZE_RANGE.max}
              >
                <Plus className="size-3" />
              </Button>
            </div>
          </div>

          {/* Line height */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Spacing
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={() =>
                  adjustValue("line_height", lineHeight, LINE_HEIGHT_RANGE, -1)
                }
                disabled={lineHeight <= LINE_HEIGHT_RANGE.min}
              >
                <Minus className="size-3" />
              </Button>
              <span className="w-8 text-center text-xs">
                {lineHeight.toFixed(1)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={() =>
                  adjustValue("line_height", lineHeight, LINE_HEIGHT_RANGE, 1)
                }
                disabled={lineHeight >= LINE_HEIGHT_RANGE.max}
              >
                <Plus className="size-3" />
              </Button>
            </div>
          </div>

          {/* Content width */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Width
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={() =>
                  adjustValue(
                    "content_width",
                    contentWidth,
                    CONTENT_WIDTH_RANGE,
                    -1
                  )
                }
                disabled={contentWidth <= CONTENT_WIDTH_RANGE.min}
              >
                <Minus className="size-3" />
              </Button>
              <span className="w-8 text-center text-xs">{contentWidth}</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={() =>
                  adjustValue(
                    "content_width",
                    contentWidth,
                    CONTENT_WIDTH_RANGE,
                    1
                  )
                }
                disabled={contentWidth >= CONTENT_WIDTH_RANGE.max}
              >
                <Plus className="size-3" />
              </Button>
            </div>
          </div>

          {/* Reset */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={handleReset}
          >
            <RotateCcw className="size-3 mr-1" />
            Reset to defaults
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
