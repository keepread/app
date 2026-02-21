"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeSlugInput } from "@focus-reader/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface OnboardingFormProps {
  initialSlug: string;
}

export function OnboardingForm({ initialSlug }: OnboardingFormProps) {
  const router = useRouter();
  const [slug, setSlug] = useState(initialSlug);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedSlug = useMemo(() => normalizeSlugInput(slug), [slug]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: { code?: string; message?: string } }
          | null;
        const code = body?.error?.code;
        if (code === "SLUG_TAKEN") {
          throw new Error("That slug is already in use. Try another one.");
        }
        if (code === "INVALID_SLUG") {
          throw new Error(
            body?.error?.message ||
              "Slug must be 3-30 characters and use lowercase letters, numbers, or hyphens."
          );
        }
        throw new Error(body?.error?.message || "Failed to update profile");
      }

      router.replace("/inbox");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to update profile"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Set up your account</h1>
        <p className="text-sm text-slate-600">
          Choose a personal slug. You can update it later from account settings.
        </p>
      </header>

      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <label
            className="block text-sm font-medium text-slate-700"
            htmlFor="slug"
          >
            Slug
          </label>
          <Input
            id="slug"
            name="slug"
            required
            autoFocus
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="your-name"
          />
          <p className="text-xs text-slate-500">
            Final slug:{" "}
            <span className="font-mono text-slate-700">
              {normalizedSlug || "(invalid)"}
            </span>
          </p>
        </div>

        <Button className="w-full" type="submit" disabled={loading}>
          {loading ? "Saving..." : "Continue to Inbox"}
        </Button>
      </form>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
