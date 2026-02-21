"use client";

import {
  createContext,
  useContext,
  useEffect,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import useSWR from "swr";

interface AuthMeUser {
  id: string;
  email: string;
  slug: string;
  onboarding_completed_at: string | null;
  name: string | null;
  avatar_url: string | null;
}

interface AuthMeResponse {
  authenticated: boolean;
  authMode: "single-user" | "multi-user";
  needsOnboarding?: boolean;
  method?: "session" | "cf-access" | "api-key" | "single-user";
  user?: AuthMeUser;
}

interface UserContextValue {
  auth: AuthMeResponse | null;
  isLoading: boolean;
  refresh: () => Promise<AuthMeResponse | undefined>;
}

const UserContext = createContext<UserContextValue | null>(null);

async function authMeFetcher(url: string): Promise<AuthMeResponse> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    return { authenticated: false, authMode: "single-user" };
  }
  return response.json() as Promise<AuthMeResponse>;
}

export function UserProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const { data, isLoading, mutate } = useSWR<AuthMeResponse>(
    "/api/auth/me",
    authMeFetcher,
    {
      revalidateOnFocus: false,
    }
  );

  useEffect(() => {
    if (isLoading || !data) return;

    if (data.authMode === "multi-user") {
      if (!data.authenticated) {
        if (pathname !== "/login" && pathname !== "/verify") {
          router.replace("/login");
        }
        return;
      }

      if (data.needsOnboarding && pathname !== "/onboarding") {
        router.replace("/onboarding");
      }
    }
  }, [data, isLoading, pathname, router]);

  if (isLoading) {
    return null;
  }

  return (
    <UserContext.Provider
      value={{
        auth: data ?? null,
        isLoading,
        refresh: async () => {
          const next = await mutate();
          return next;
        },
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUser must be used within UserProvider");
  }
  return ctx;
}
