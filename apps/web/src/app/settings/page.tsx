"use client";

import { useTheme } from "next-themes";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { usePreferences } from "@/hooks/use-preferences";
import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";
import {
  FONT_FAMILIES,
  FONT_SIZE_RANGE,
  LINE_HEIGHT_RANGE,
  CONTENT_WIDTH_RANGE,
} from "@focus-reader/shared";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const {
    preferences,
    updatePreference,
    fontSize,
    lineHeight,
    contentWidth,
  } = usePreferences();

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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold mb-1">General</h1>
        <p className="text-sm text-muted-foreground">
          Manage your app preferences.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Theme</h2>
        <RadioGroup
          value={theme}
          onValueChange={setTheme}
          className="flex gap-4"
        >
          {["light", "dark", "system"].map((t) => (
            <label
              key={t}
              className="flex items-center gap-2 cursor-pointer text-sm"
            >
              <RadioGroupItem value={t} />
              <span className="capitalize">{t}</span>
            </label>
          ))}
        </RadioGroup>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium">Reading</h2>

        <div>
          <label className="text-xs text-muted-foreground">Font Family</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {FONT_FAMILIES.map((f) => (
              <button
                key={f.value}
                onClick={() => updatePreference({ font_family: f.value })}
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  currentFontFamily === f.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-accent"
                }`}
                style={{ fontFamily: f.css }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className="text-xs text-muted-foreground">Font Size</label>
            <p className="text-sm">{fontSize}px</p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() =>
                adjustValue("font_size", fontSize, FONT_SIZE_RANGE, -1)
              }
              disabled={fontSize <= FONT_SIZE_RANGE.min}
            >
              <Minus className="size-3" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() =>
                adjustValue("font_size", fontSize, FONT_SIZE_RANGE, 1)
              }
              disabled={fontSize >= FONT_SIZE_RANGE.max}
            >
              <Plus className="size-3" />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className="text-xs text-muted-foreground">Line Height</label>
            <p className="text-sm">{lineHeight.toFixed(1)}</p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() =>
                adjustValue("line_height", lineHeight, LINE_HEIGHT_RANGE, -1)
              }
              disabled={lineHeight <= LINE_HEIGHT_RANGE.min}
            >
              <Minus className="size-3" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() =>
                adjustValue("line_height", lineHeight, LINE_HEIGHT_RANGE, 1)
              }
              disabled={lineHeight >= LINE_HEIGHT_RANGE.max}
            >
              <Plus className="size-3" />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className="text-xs text-muted-foreground">Content Width</label>
            <p className="text-sm">{contentWidth}px</p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
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
            <Button
              variant="outline"
              size="icon"
              className="size-8"
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

        <div
          className="rounded-lg border p-4"
          style={{
            fontFamily:
              FONT_FAMILIES.find((f) => f.value === currentFontFamily)?.css ??
              FONT_FAMILIES[0].css,
            fontSize: `${fontSize}px`,
            lineHeight: `${lineHeight}`,
          }}
        >
          <p className="text-muted-foreground">
            The quick brown fox jumps over the lazy dog. This is a preview of
            your reading preferences.
          </p>
        </div>
      </section>
    </div>
  );
}
