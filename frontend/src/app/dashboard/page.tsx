"use client";

import {
  BatteryMedium,
  Bike,
  Car,
  Plus,
  RadioTower,
  Route,
  SlidersHorizontal,
  Truck,
} from "lucide-react";
import { useMemo, useState } from "react";
import Link from "next/link";

import { AddVehicleModal } from "@/components/forms/AddVehicleModal";
import { SetupWorkspaceModal } from "@/components/forms/SetupWorkspaceModal";
import { MapView } from "@/components/map/MapView";
import { KPIStatCard } from "@/components/ui/KPIStatCard";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { LiveTrackerPacket, useAllTrackers, useLiveTracker } from "@/lib/liveTracker";
import { useWorkspace } from "@/lib/workspace";
import { Vehicle } from "@/types";

function VehicleTypeIcon({
  type,
  ...props
}: { type: string } & Parameters<typeof Car>[0]) {
  const lower = type.toLowerCase();
  if (lower.includes("motorcycle") || lower.includes("bike")) return <Bike {...props} />;
  if (
    lower.includes("truck") ||
    lower.includes("van") ||
    lower.includes("trailer") ||
    lower.includes("box")
  )
    return <Truck {...props} />;
  return <Car {...props} />;
}

function formatRelativeTime(iso: string | undefined): string {
  if (!iso) return "No data";
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function VehicleStatusCard({
  vehicle,
  tracker,
}: {
  vehicle: Vehicle;
  tracker: LiveTrackerPacket | null;
}) {
  const speedKph = Number(tracker?.gps?.speed_kph ?? 0);
  const speedMph = Math.round(speedKph * 0.621371);
  const isMoving = speedMph > 3;
  const isOnline = Boolean(tracker?.received_at);
  const hasGps = Boolean(tracker?.has_fix);

  const battPct =
    tracker?.battery_mv != null
      ? Math.max(0, Math.min(100, Math.round((((tracker.battery_mv) - 3300) / 900) * 100)))
      : null;
  const signalPct =
    tracker?.cell_rssi != null
      ? Math.max(0, Math.min(100, Math.round(((tracker.cell_rssi) / 31) * 100)))
      : null;

  const dotColor = isMoving
    ? "bg-green-500"
    : isOnline && hasGps
    ? "bg-slate-300"
    : isOnline
    ? "bg-amber-400"
    : "bg-slate-200";

  const chipColor = isMoving
    ? "bg-green-100 text-green-700"
    : isOnline
    ? "bg-slate-100 text-slate-500"
    : "bg-slate-50 text-slate-400";

  const statusLabel = isMoving
    ? `${speedMph} mph`
    : isOnline
    ? "Stopped"
    : "Not reporting";

  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-brand-cloud/40 transition-colors">
      <div className="relative mt-0.5 shrink-0">
        <div className="h-11 w-11 overflow-hidden rounded-full border-2 border-brand-line bg-brand-cloud flex items-center justify-center">
          {vehicle.photo ? (
            <img src={vehicle.photo} alt={vehicle.name} className="h-full w-full object-cover" />
          ) : (
            <VehicleTypeIcon type={vehicle.type} size={18} className="text-brand-navy" />
          )}
        </div>
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${dotColor}`}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-brand-ink truncate">{vehicle.name}</p>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${chipColor}`}>
            {statusLabel}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-slate-500 truncate">
          {vehicle.type}
          {vehicle.deviceAssignment && vehicle.deviceAssignment !== "Not assigned"
            ? ` · ${vehicle.deviceAssignment}`
            : " · No tracker assigned"}
        </p>
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
  const { liveTracker } = useLiveTracker();
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

  const movingCount = vehiclesWithLiveData.filter((v) => {
    const mph = Math.round(Number(v.tracker?.gps?.speed_kph ?? 0) * 0.621371);
    return mph > 3;
  }).length;

  const gpsActiveCount = allTrackers.filter((t) => t.has_fix).length;

  const kpis = useMemo(
    () => [
      {
        label: "In motion",
        value: String(movingCount),
        delta: movingCount > 0 ? "Moving now" : "All stopped",
        tone: movingCount > 0 ? ("green" as const) : ("navy" as const),
      },
      {
        label: "GPS active",
        value: String(gpsActiveCount),
        delta: gpsActiveCount > 0 ? "Live fixes" : "No fix yet",
        tone: gpsActiveCount > 0 ? ("green" as const) : ("amber" as const),
      },
      {
        label: "Fleet size",
        value: String(state.vehicles.length),
        delta: "Vehicles",
        tone: "navy" as const,
      },
      {
        label: "Service area",
        value: hasServiceArea ? serviceArea.label : "Not set",
        delta: "Region",
        tone: "navy" as const,
      },
    ],
    [movingCount, gpsActiveCount, state.vehicles.length, hasServiceArea, serviceArea.label],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase text-brand-forest">
            {state.companyName}
          </p>
          <h1 className="mt-1 text-3xl font-bold text-brand-ink">Operations Dashboard</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Live vehicle locations and fleet status.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setCompanyOpen(true)}>
            <SlidersHorizontal size={16} className="mr-2" />
            Company Details
          </Button>
          <Button onClick={() => setAddVehicleOpen(true)}>
            <Plus size={16} className="mr-2" />
            Add Vehicle
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((stat) => (
          <KPIStatCard key={stat.label} stat={stat} />
        ))}
      </div>

      {/* Map + fleet status */}
      <div className="grid gap-5 2xl:grid-cols-[1fr_360px]">
        <MapView />

        <SectionCard className="overflow-hidden">
          <div className="border-b border-brand-line px-5 py-4">
            <h2 className="text-base font-semibold text-brand-ink">Fleet status</h2>
            <p className="text-sm text-slate-500">
              {allTrackers.length > 0
                ? `${allTrackers.length} tracker${allTrackers.length > 1 ? "s" : ""} reporting · updates every 15 s`
                : "Live updates every 15 seconds"}
            </p>
          </div>
          {vehiclesWithLiveData.length > 0 ? (
            <div className="divide-y divide-brand-line">
              {vehiclesWithLiveData.map((v) => (
                <VehicleStatusCard key={v.id} vehicle={v} tracker={v.tracker} />
              ))}
            </div>
          ) : (
            <div className="p-5">
              <p className="text-sm text-slate-400">
                No vehicles yet.{" "}
                <button
                  onClick={() => setAddVehicleOpen(true)}
                  className="font-medium text-brand-navy hover:underline"
                >
                  Add one now
                </button>{" "}
                to see live status here.
              </p>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Quick actions */}
      <SectionCard className="p-5">
        <h2 className="text-base font-semibold text-brand-ink">Quick actions</h2>
        <div className="mt-4 grid gap-3 grid-cols-2 md:grid-cols-4">
          <Button className="justify-start" onClick={() => setAddVehicleOpen(true)}>
            <Plus size={15} className="mr-2" />
            Add vehicle
          </Button>
          <Link
            href="/devices"
            className="inline-flex h-10 items-center rounded-md border border-brand-line bg-white px-4 text-sm font-semibold text-brand-ink transition hover:bg-brand-cloud"
          >
            Assign trackers
          </Link>
          <Link
            href="/trips"
            className="inline-flex h-10 items-center rounded-md border border-brand-line bg-white px-4 text-sm font-semibold text-brand-ink transition hover:bg-brand-cloud"
          >
            <Route size={15} className="mr-2" />
            View trips
          </Link>
          <Link
            href="/settings"
            className="inline-flex h-10 items-center rounded-md border border-brand-line bg-white px-4 text-sm font-semibold text-brand-ink transition hover:bg-brand-cloud"
          >
            Settings
          </Link>
        </div>
      </SectionCard>

      <SetupWorkspaceModal open={companyOpen} onClose={() => setCompanyOpen(false)} />
      <AddVehicleModal open={addVehicleOpen} onClose={() => setAddVehicleOpen(false)} />
    </div>
  );
}
