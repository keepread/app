import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveServerAuthState } from "@/lib/server-auth";
import { ReaderLayoutClient } from "./reader-layout-client";

export default async function ReaderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authState = await resolveServerAuthState(new Headers(await headers()));
  if (authState.authMode === "multi-user") {
    if (!authState.authenticated) {
      redirect("/login");
    }
    if (authState.needsOnboarding) {
      redirect("/onboarding");
    }
  }

  return <ReaderLayoutClient>{children}</ReaderLayoutClient>;
}
