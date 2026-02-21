"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeSlugInput } from "@focus-reader/shared";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface OnboardingFormProps {
  initialSlug: string;
}

interface SettingsResponse {
  emailDomain: string | null;
}

export function OnboardingForm({ initialSlug }: OnboardingFormProps) {
  const router = useRouter();
  const [slug, setSlug] = useState(initialSlug);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: settings } = useSWR<SettingsResponse>("/api/settings", async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Failed to fetch settings");
    }
    return response.json() as Promise<SettingsResponse>;
  });

  const normalizedSlug = useMemo(() => normalizeSlugInput(slug), [slug]);
  const emailDomain = settings?.emailDomain ?? null;

  const localPartPreview = normalizedSlug || "your-tag";
  const addressPreview = emailDomain
    ? `${localPartPreview}@${emailDomain}`
    : `${localPartPreview}@your-domain.com`;
  const aliasPreview = emailDomain
    ? `newsletters+${localPartPreview}@${emailDomain}`
    : `newsletters+${localPartPreview}@your-domain.com`;

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
        <h1 className="text-xl font-semibold">Personalize your email address</h1>
        <p className="text-base text-slate-600">
          Choose the email name you'll use for newsletters. You can change it anytime in Settings.
        </p>
      </header>

      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <p>
              Your inbox address will be{" "}
              <span className="font-mono text-slate-900">{addressPreview}</span>.
            </p>
            <p className="mt-1">
              You can also use tagged aliases like{" "}
              <span className="font-mono text-slate-900">{aliasPreview}</span>.
            </p>
          </div>
          <label
            className="block text-sm font-medium text-slate-700"
            htmlFor="slug"
          >
            Email name
          </label>
          <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
            <Input
              id="slug"
              name="slug"
              required
              autoFocus
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="your-name"
              className="h-11 rounded-r-none border-0 focus-visible:ring-0"
            />
            <div className="h-11 shrink-0 rounded-r-md border-l border-input px-3 text-sm leading-[44px] text-slate-500">
              @{emailDomain || "your-domain.com"}
            </div>
          </div>
          <p className="text-xs text-slate-500">3-30 chars, lowercase letters, numbers, hyphens.</p>
        </div>

        <Button className="w-full" type="submit" disabled={loading}>
          {loading ? "Saving..." : "Continue to Inbox"}
        </Button>
      </form>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
