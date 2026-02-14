"use client";

import { useTheme } from "next-themes";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold mb-1">General</h1>
        <p className="text-sm text-muted-foreground">
          Manage your app preferences.
        </p>
      </div>

      {/* Theme */}
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

      {/* Account */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium">Account</h2>
        <p className="text-sm text-muted-foreground">
          Single-user mode. Authentication will be added in a future update.
        </p>
      </section>
    </div>
  );
}
