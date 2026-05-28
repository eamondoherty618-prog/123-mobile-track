"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { StickyFilterPanel, MobileFilterDrawer } from "@/components/filters/StickyFilterPanel";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { TopHeader } from "@/components/layout/TopHeader";
import { PwaInstallPrompt } from "@/components/mobile/PwaInstallPrompt";
import { useAuth } from "@/lib/auth";
import { navigationItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";

// Only the most-used nav items in mobile bottom bar
const mobileNavItems = navigationItems.filter((item) =>
  ["/dashboard", "/vehicles", "/trips", "/alerts", "/settings"].includes(item.href),
);

function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-brand-line bg-white lg:hidden">
      {mobileNavItems.map((item) => {
        const active = pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition",
              active ? "text-brand-navy" : "text-slate-400",
            )}
          >
            <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loaded } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (!loaded) return;
    if (pathname === "/login" && user) {
      router.replace("/dashboard");
    } else if (pathname !== "/login" && !user) {
      router.replace("/login");
    }
  }, [loaded, pathname, user, router]);

  // Login page gets its own bare layout
  if (pathname === "/login") {
    return <>{children}</>;
  }

  // Wait for auth check before rendering anything
  if (!loaded || !user) return null;

  return (
    <div className="min-h-screen bg-brand-cloud">
      <div className="mx-auto flex min-h-screen max-w-[1720px]">
        <SidebarNav
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((v) => !v)}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopHeader onOpenFilters={() => setFiltersOpen(true)} />
          <main className="flex-1 px-4 py-5 pb-20 lg:px-6 lg:pb-5">
            <div className="mb-5 xl:hidden">
              <PwaInstallPrompt />
            </div>
            <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
              <StickyFilterPanel />
              <div className="min-w-0">{children}</div>
            </div>
          </main>
        </div>
      </div>

      <MobileBottomNav />
      <MobileFilterDrawer open={filtersOpen} onClose={() => setFiltersOpen(false)} />
    </div>
  );
}
