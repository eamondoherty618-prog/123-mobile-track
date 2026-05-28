"use client";

import {
  BatteryMedium,
  Bike,
  Car,
  CircleDot,
  MapPin,
  Plus,
  RadioTower,
  ShieldAlert,
  SlidersHorizontal,
  Truck,
} from "lucide-react";
import { useMemo, useState } from "react";
import Link from "next/link";

import { AddVehicleModal } from "@/components/forms/AddVehicleModal";
import { SetupWorkspaceModal } from "@/components/forms/SetupWorkspaceModal";
import { MapView } from "@/components/map/MapView";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { LiveTrackerPacket, useAllTrackers, useLiveTracker } from "@/lib/liveTracker";
import { useWorkspace } from "@/lib/workspace";
import { Vehicle } from "@/types";

function VehicleTypeIcon({ type, ...props }: { type: string } & Parameters<typeof Car>[0]) {
  const lower = type.toLowerCase();
  if (lower.includes("motorcycle") || lower.includes("bike")) return <Bike {...props} />;
  if (lower.includes("truck") || lower.includes("van") || lower.includes("trailer") || lower.includes("box"))
    return <Truck {...props} />;
  return <Car {...props} />;
}

function formatRelativeTime(iso: string | undefined): string {
  if (!iso) return "";
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function VehicleCard({
  vehicle,
  tracker,
}: {
  vehicle: Vehicle;
  tracker: LiveTrackerPacket | null;
}) {
  const speedMph = Math.round(Number(tracker?.gps?.speed_kph ?? 0) * 0.621371);
  const isMoving = speedMph > 3;
  const isOnline = Boolean(tracker?.received_at);
  const hasGps = Boolean(tracker?.has_fix);
  const hasTracker = vehicle.deviceAssignment && vehicle.deviceAssignment !== "Not assigned";

  const battPct =
    tracker?.battery_mv != null
      ? Math.max(0, Math.min(100, Math.round((((tracker.battery_mv) - 3300) / 900) * 100)))
      : null;
  const signalPct =
    tracker?.cell_rssi != null
      ? Math.max(0, Math.min(100, Math.round(((tracker.cell_rssi) / 31) * 100)))
      : null;

  const dotColor = !hasTracker
    ? "bg-slate-200"
    : isMoving
    ? "bg-green-500"
    : isOnline && hasGps
    ? "bg-brand-navy"
    : isOnline
    ? "bg-amber-400"
    : "bg-slate-300";

  const statusLabel = !hasTracker
    ? "No tracker"
    : isMoving
    ? `${speedMph} mph`
    : isOnline
    ? "Stopped"
    : "Offline";

  const statusColor = !hasTracker
    ? "text-slate-400"
    : isMoving
    ? "text-green-600 font-semibold"
    : isOnline
    ? "text-slate-600"
    : "text-slate-400";

  return (
    <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-brand-cloud/40 transition-colors">
      {/* Avatar */}
      <div className="relative shrink-0">
        <div className="h-12 w-12 overflow-hidden rounded-full border-2 border-brand-line bg-brand-cloud flex items-center justify-center">
          {vehicle.photo ? (
            <img src={vehicle.photo} alt={vehicle.name} className="h-full w-full object-cover" />
          ) : (
            <VehicleTypeIcon type={vehicle.type} size={20} className="text-brand-navy" />
          )}
        </div>
        <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${dotColor}`} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-brand-ink truncate">{vehicle.name}</p>
          <span className={`shrink-0 text-xs ${statusColor}`}>{statusLabel}</span>
        </div>
        <p className="text-xs text-slate-400 truncate">{vehicle.type}</p>
        {isOnline && (
          <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
            {battPct !== null && (
              <span className="flex items-center gap-0.5">
                <BatteryMedium size={11} />
                {battPct}%
              </span>
            )}
            {signalPct !== null && (
              <span className="flex items-center gap-0.5">
                <RadioTower size={11} />
                {signalPct}%
              </span>
            )}
            <span>{formatRelativeTime(tracker?.received_at)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { state, hasServiceArea, serviceArea } = useWorkspace();
  const allTrackers = useAllTrackers();
  const [companyOpen, setCompanyOpen] = useState(false);
  const [addVehicleOpen, setAddVehicleOpen] = useState(false);

  const trackerMap = useMemo(
    () => Object.fromEntries(allTrackers.map((t) => [t.device_id, t])),
    [allTrackers],
  );

  const vehiclesWithLiveData = useMemo(
    () =>
      state.vehicles.map((v) => ({
        ...v,
        tracker:
          v.deviceAssignment && v.deviceAssignment !== "Not assigned"
            ? (trackerMap[v.deviceAssignment] ?? null)
            : null,
      })),
    [state.vehicles, trackerMap],
  );

  const movingCount = vehiclesWithLiveData.filter(
    (v) => Math.round(Number(v.tracker?.gps?.speed_kph ?? 0) * 0.621371) > 3,
  ).length;
  const onlineCount = vehiclesWithLiveData.filter((v) => v.tracker?.received_at).length;
  const gpsCount = allTrackers.filter((t) => t.has_fix).length;

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-forest">
            {state.companyName}
          </p>
          <h1 className="text-xl font-bold text-brand-ink sm:text-2xl lg:text-3xl">Dashboard</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCompanyOpen(true)}
            className="hidden h-9 items-center gap-2 rounded-lg border border-brand-line bg-white px-3 text-sm font-medium text-brand-ink transition hover:bg-brand-cloud sm:inline-flex"
          >
            <SlidersHorizontal size={14} />
            Settings
          </button>
          <Button onClick={() => setAddVehicleOpen(true)} className="h-9 px-3 text-sm">
            <Plus size={14} className="mr-1.5" />
            Add vehicle
          </Button>
        </div>
      </div>

      {/* Quick stats bar */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <SectionCard className="flex items-center gap-2.5 px-3 py-3 sm:px-4">
          <CircleDot size={16} className={movingCount > 0 ? "text-green-500" : "text-slate-300"} />
          <div>
            <p className="text-xs text-slate-500">In motion</p>
            <p className="text-base font-bold text-brand-ink sm:text-lg">{movingCount}</p>
          </div>
        </SectionCard>
        <SectionCard className="flex items-center gap-2.5 px-3 py-3 sm:px-4">
          <RadioTower size={16} className={onlineCount > 0 ? "text-brand-navy" : "text-slate-300"} />
          <div>
            <p className="text-xs text-slate-500">Online</p>
            <p className="text-base font-bold text-brand-ink sm:text-lg">{onlineCount}</p>
          </div>
        </SectionCard>
        <SectionCard className="flex items-center gap-2.5 px-3 py-3 sm:px-4">
          <MapPin size={16} className={gpsCount > 0 ? "text-brand-forest" : "text-slate-300"} />
          <div>
            <p className="text-xs text-slate-500">GPS active</p>
            <p className="text-base font-bold text-brand-ink sm:text-lg">{gpsCount}</p>
          </div>
        </SectionCard>
      </div>

      {/* Map — takes up the full width, prominent */}
      <MapView />

      {/* Fleet status */}
      <SectionCard className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-brand-line px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-sm font-semibold text-brand-ink sm:text-base">Fleet status</h2>
            <p className="text-xs text-slate-500">
              {state.vehicles.length > 0
                ? `${state.vehicles.length} vehicle${state.vehicles.length > 1 ? "s" : ""}`
                : "No vehicles yet"}
              {allTrackers.length > 0 ? ` · ${allTrackers.length} tracker${allTrackers.length > 1 ? "s" : ""} online` : ""}
            </p>
          </div>
          {state.vehicles.length > 0 && (
            <Link
              href="/vehicles"
              className="text-xs font-medium text-brand-navy hover:underline"
            >
              View all
            </Link>
          )}
        </div>

        {vehiclesWithLiveData.length > 0 ? (
          <div className="divide-y divide-brand-line">
            {vehiclesWithLiveData.map((v) => (
              <VehicleCard key={v.id} vehicle={v} tracker={v.tracker} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center py-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-cloud">
              <Car size={22} className="text-brand-navy" />
            </div>
            <p className="text-sm font-semibold text-brand-ink">No vehicles yet</p>
            <p className="mt-1 text-xs text-slate-500">Add a vehicle to see live status here</p>
            <button
              onClick={() => setAddVehicleOpen(true)}
              className="mt-4 rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-forest"
            >
              Add first vehicle
            </button>
          </div>
        )}
      </SectionCard>

      {/* Bottom row: alerts link + quick settings */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/alerts"
          className="flex items-center gap-3 rounded-xl border border-brand-line bg-white px-4 py-3 transition hover:bg-brand-cloud"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50">
            <ShieldAlert size={18} className="text-red-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-brand-ink">Alerts</p>
            <p className="text-xs text-slate-500 truncate">Speed, hard stops, offline</p>
          </div>
        </Link>
        <Link
          href="/trips"
          className="flex items-center gap-3 rounded-xl border border-brand-line bg-white px-4 py-3 transition hover:bg-brand-cloud"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-mint">
            <MapPin size={18} className="text-brand-forest" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-brand-ink">Trips</p>
            <p className="text-xs text-slate-500 truncate">History & routes</p>
          </div>
        </Link>
      </div>

      {!hasServiceArea && (
        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">Service area not set — </p>
          <Link href="/settings" className="text-sm font-semibold text-amber-700 hover:underline">
            Set it now
          </Link>
        </div>
      )}

      <SetupWorkspaceModal open={companyOpen} onClose={() => setCompanyOpen(false)} />
      <AddVehicleModal open={addVehicleOpen} onClose={() => setAddVehicleOpen(false)} />
    </div>
  );
}
