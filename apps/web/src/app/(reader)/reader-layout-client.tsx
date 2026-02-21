"use client";

import { Suspense } from "react";
import { SWRConfig } from "swr";
import { AppProvider } from "@/contexts/app-context";
import { AppShell } from "@/components/layout/app-shell";
import { apiFetch } from "@/lib/api-client";
import { UserProvider } from "@/lib/user-context";

export function ReaderLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SWRConfig
      value={{
        fetcher: (url: string) => apiFetch(url),
        revalidateOnFocus: false,
      }}
    >
      <UserProvider>
        <AppProvider>
          <Suspense>
            <AppShell>{children}</AppShell>
          </Suspense>
        </AppProvider>
      </UserProvider>
    </SWRConfig>
  );
}
