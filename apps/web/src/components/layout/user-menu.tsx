"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/lib/user-context";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

async function getGravatarUrl(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const encoded = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `https://www.gravatar.com/avatar/${hashHex}?d=404&s=80`;
}

export function UserMenu() {
  const { auth } = useUser();
  const router = useRouter();
  const [gravatarUrl, setGravatarUrl] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const user = auth?.user;

  useEffect(() => {
    let isActive = true;
    const email = user?.email?.trim();
    const avatarUrl = user?.avatar_url?.trim();

    if (!email || avatarUrl) {
      setGravatarUrl(null);
      return () => {
        isActive = false;
      };
    }

    getGravatarUrl(email)
      .then((url) => {
        if (isActive) {
          setGravatarUrl(url);
        }
      })
      .catch(() => {
        if (isActive) {
          setGravatarUrl(null);
        }
      });

    return () => {
      isActive = false;
    };
  }, [user?.email, user?.avatar_url]);

  if (auth?.authMode !== "multi-user" || !user) {
    return null;
  }

  const displayName = user.name?.trim() || user.email?.trim() || "Account";
  const displayEmail = user.email?.trim();
  const avatarSrc = user.avatar_url?.trim() || gravatarUrl || undefined;
  const fallback = displayName.charAt(0).toUpperCase();

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      if (!response.ok) {
        throw new Error(`Logout failed (${response.status})`);
      }
      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("[user-menu][logout]", error);
      toast.error("Failed to log out. Please try again.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          <Avatar className="size-5 flex-shrink-0">
            {avatarSrc && <AvatarImage src={avatarSrc} alt={displayName} />}
            <AvatarFallback className="text-[10px]">{fallback}</AvatarFallback>
          </Avatar>
          <span className="truncate">{displayName}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="font-medium">{displayName}</div>
          {displayEmail ? <div className="text-xs font-normal text-muted-foreground">{displayEmail}</div> : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer" disabled={isLoggingOut}>
          <LogOut className="mr-2 size-4" />
          {isLoggingOut ? "Logging out..." : "Log out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
