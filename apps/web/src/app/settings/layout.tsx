"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Mail, Shield, Rss } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const SETTINGS_NAV = [
  { label: "General", path: "/settings", icon: null },
  { label: "Subscriptions", path: "/settings/subscriptions", icon: Rss },
  { label: "Denylist", path: "/settings/denylist", icon: Shield },
  { label: "Email", path: "/settings/email", icon: Mail },
] as const;

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-background">
      {/* Settings sidebar */}
      <aside className="w-60 border-r flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <Link href="/inbox">
            <Button variant="ghost" size="icon" className="size-8">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <span className="text-sm font-semibold">Settings</span>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {SETTINGS_NAV.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-accent font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {item.icon && <item.icon className="size-4" />}
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Settings content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
