"use client";

import { useMemo, useState } from "react";
import { Bell, CalendarRange, Filter, LogOut, Search } from "lucide-react";
import { useRouter } from "next/navigation";

import { BrandLogo } from "@/components/branding/BrandLogo";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";

interface TopHeaderProps {
  onOpenFilters: () => void;
}

export function TopHeader({ onOpenFilters }: TopHeaderProps) {
  const { state, notifications, setDateRange } = useWorkspace();
  const { logout } = useAuth();
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);
  const dateRanges = useMemo(() => ["Today", "Last 7 days", "Last 30 days", "This month"] as const, []);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-20 border-b border-brand-line bg-white/90 backdrop-blur">
      <div className="flex items-center gap-2 px-4 py-3 lg:gap-3 lg:px-6 lg:py-4">
        <BrandLogo className="mr-1 shrink-0 lg:hidden" />

        {/* Search — hidden on mobile, visible on sm+ */}
        <div className="relative hidden min-w-0 flex-1 sm:block">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="h-10 w-full rounded-md border border-brand-line bg-brand-cloud pl-9 pr-4 text-sm outline-none transition focus:border-brand-forest"
            placeholder="Search vehicles, devices, drivers…"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Date range — hidden on mobile */}
          <button
            onClick={() => {
              const idx = dateRanges.indexOf(state.dateRange);
              setDateRange(dateRanges[(idx + 1) % dateRanges.length]);
            }}
            className="hidden h-10 items-center gap-2 rounded-md border border-brand-line px-3 text-sm font-medium text-brand-text md:inline-flex"
          >
            <CalendarRange size={15} />
            <span className="hidden lg:inline">{state.dateRange}</span>
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications((v) => !v)}
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-brand-line text-brand-text"
            >
              <Bell size={17} />
              {notifications.length > 0 && (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
              )}
            </button>
            {showNotifications && (
              <div className="absolute right-0 top-12 z-30 w-80 rounded-lg border border-brand-line bg-white p-3 shadow-panel">
                <p className="text-sm font-semibold text-brand-ink">Updates</p>
                <div className="mt-3 space-y-2">
                  {notifications.length > 0 ? (
                    notifications.map((item) => (
                      <div key={item.id} className="rounded-md border border-brand-line bg-brand-cloud px-3 py-3">
                        <p className="text-sm font-semibold text-brand-ink">{item.title}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">Everything looks good.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Filters button (mobile) */}
          <Button variant="secondary" onClick={onOpenFilters} className="h-10 lg:hidden">
            <Filter size={15} className="mr-1.5" />
            Filters
          </Button>

          {/* User chip (desktop) */}
          <div className="hidden h-10 items-center gap-2.5 rounded-md border border-brand-line px-3 lg:flex">
            <div className="h-7 w-7 rounded-full bg-brand-forest text-center text-xs font-bold leading-7 text-white">
              {state.adminName.split(" ").map((p) => p[0]).join("").slice(0, 2)}
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-brand-ink leading-tight">{state.adminName}</p>
              <p className="text-xs text-slate-500 leading-tight">{state.companyName}</p>
            </div>
            <button
              onClick={handleLogout}
              className="ml-0.5 rounded p-1 text-slate-400 transition hover:text-red-500"
              title="Sign out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
