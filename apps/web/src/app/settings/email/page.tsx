"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { normalizeSlugInput } from "@focus-reader/shared";
import { apiFetch } from "@/lib/api-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const SLUG_PATTERN = /^[a-z0-9-]+$/;
const MIN_SLUG_LENGTH = 3;
const MAX_SLUG_LENGTH = 30;

interface SettingsResponse {
  emailDomain: string | null;
}

interface AuthMeUser {
  id: string;
  email: string;
  slug: string;
}

interface AuthMeResponse {
  authenticated: boolean;
  authMode: "single-user" | "multi-user";
  user?: AuthMeUser;
}

async function authMeFetcher(url: string): Promise<AuthMeResponse> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    return { authenticated: false, authMode: "single-user" };
  }
  return response.json() as Promise<AuthMeResponse>;
}

function getEmailNameValidationError(value: string): string | null {
  if (!value) return "Email name is required.";
  if (value.length < MIN_SLUG_LENGTH || value.length > MAX_SLUG_LENGTH) {
    return "Email name must be between 3 and 30 characters.";
  }
  if (!SLUG_PATTERN.test(value)) {
    return "Email name can only contain lowercase letters, numbers, and hyphens.";
  }
  return null;
}

export default function EmailSettingsPage() {
  const { data: settings } = useSWR("/api/settings", (url: string) =>
    apiFetch<SettingsResponse>(url)
  );
  const { data: auth, mutate: refreshAuth } = useSWR<AuthMeResponse>(
    "/api/auth/me",
    authMeFetcher
  );

  const [emailName, setEmailName] = useState(auth?.user?.slug ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (auth?.user?.slug) {
      setEmailName(auth.user.slug);
    }
  }, [auth?.user?.slug]);

  const normalizedEmailName = useMemo(
    () => normalizeSlugInput(emailName),
    [emailName]
  );
  const validationError = useMemo(
    () => getEmailNameValidationError(normalizedEmailName),
    [normalizedEmailName]
  );

  const isMultiUser = auth?.authMode === "multi-user" && !!auth.user;
  const domain = settings?.emailDomain ?? null;
  const forwardAddress = domain
    ? `${normalizedEmailName || "your-name"}@${domain}`
    : null;
  const taggedAddress = domain
    ? `newsletters+${normalizedEmailName || "your-name"}@${domain}`
    : null;
  const hasChanges = normalizedEmailName !== (auth?.user?.slug ?? "");
  const canSave = isMultiUser && hasChanges && !validationError && !isSaving;

  const saveEmailName = async () => {
    if (!canSave) return;
    setIsSaving(true);
    setSaveError(null);

    try {
      const response = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: normalizedEmailName }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: { code?: string; message?: string } }
          | null;
        const code = body?.error?.code;
        if (code === "SLUG_TAKEN") {
          throw new Error("That email name is already in use. Try another one.");
        }
        if (code === "INVALID_SLUG") {
          throw new Error(
            body?.error?.message ||
              "Email name must be 3-30 characters and use lowercase letters, numbers, or hyphens."
          );
        }
        throw new Error(body?.error?.message || "Failed to update email name");
      }

      await refreshAuth();
      toast("Email address updated");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update email name";
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">Email Ingestion</h1>
        <p className="text-sm text-muted-foreground">
          Your email ingestion settings.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Forward email</h2>
        <p className="text-sm text-muted-foreground">
          Forward newsletters to your inbox address. Incoming emails will be
          automatically processed and added to your library.
        </p>
        <div className="rounded-lg border p-4 bg-muted/50">
          {forwardAddress ? (
            <p className="text-sm">
              Inbox address:{" "}
              <span className="font-mono font-semibold">{forwardAddress}</span>
            </p>
          ) : (
            <p className="text-sm font-mono">
              No email domain configured. Set <code>EMAIL_DOMAIN</code> in your
              environment or configure email routing in the Cloudflare dashboard
              under{" "}
              <span className="font-semibold">Email Routing &rarr; Email Workers</span>.
            </p>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Personalize email address</h2>
        <p className="text-sm text-muted-foreground">
          Choose the email name you'll use for newsletters.
        </p>

        {taggedAddress ? (
          <p className="text-xs text-muted-foreground">
            You can also use extra addresses like{" "}
            <span className="font-mono">{taggedAddress}</span>.
          </p>
        ) : null}

        {isMultiUser ? (
          <div className="space-y-3 rounded-lg border p-4">
            <div className="space-y-2">
              <label
                className="block text-xs text-muted-foreground"
                htmlFor="email-name"
              >
                Email name
              </label>
              <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                <Input
                  id="email-name"
                  value={emailName}
                  onChange={(event) => setEmailName(event.target.value)}
                  className="h-11 rounded-r-none border-0 focus-visible:ring-0"
                  placeholder="your-name"
                />
                <div className="h-11 shrink-0 rounded-r-md border-l border-input px-3 text-sm leading-[44px] text-muted-foreground">
                  @{domain || "your-domain.com"}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                3-30 chars, lowercase letters, numbers, hyphens.
              </p>
              {validationError ? (
                <p className="text-xs text-rose-700">{validationError}</p>
              ) : null}
              {saveError ? <p className="text-xs text-rose-700">{saveError}</p> : null}
            </div>

            <div className="flex items-center gap-2">
              <Button disabled={!canSave} onClick={saveEmailName}>
                {isSaving ? "Saving..." : "Save"}
              </Button>
              <Button
                variant="ghost"
                disabled={isSaving || !hasChanges}
                onClick={() => {
                  setEmailName(auth?.user?.slug ?? "");
                  setSaveError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Personal email names are available in multi-user mode.
          </p>
        )}
      </section>
    </div>
  );
}
