"use client";

import { Suspense } from "react";
import { SWRConfig } from "swr";
import { AppProvider } from "@/contexts/app-context";
import { AppShell } from "@/components/layout/app-shell";
import { apiFetch } from "@/lib/api-client";

export default function ReaderLayout({
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
      <AppProvider>
        <Suspense>
          <AppShell>{children}</AppShell>
        </Suspense>
      </AppProvider>
    </SWRConfig>
  );
}
