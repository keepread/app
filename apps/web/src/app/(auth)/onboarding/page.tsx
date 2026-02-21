import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveServerAuthState } from "@/lib/server-auth";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const authState = await resolveServerAuthState(new Headers(await headers()));
  if (authState.authMode !== "multi-user") {
    redirect("/inbox");
  }
  if (!authState.authenticated) {
    redirect("/login");
  }
  if (!authState.needsOnboarding) {
    redirect("/inbox");
  }

  return <OnboardingForm initialSlug={authState.user?.slug ?? ""} />;
}
