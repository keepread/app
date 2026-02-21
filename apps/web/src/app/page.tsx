import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveServerAuthState } from "@/lib/server-auth";

export default async function Home() {
  const authState = await resolveServerAuthState(new Headers(await headers()));
  if (authState.authMode === "multi-user") {
    if (!authState.authenticated) {
      redirect("/login");
    }
    if (authState.needsOnboarding) {
      redirect("/onboarding");
    }
  }

  redirect("/inbox");
}
