"use client";

import { Cpu, RadioTower, SlidersHorizontal, Zap } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { TrackingProfileCard } from "@/components/ui/TrackingProfileCard";
import { buildPrototypeDevice, useAllTrackers, useLiveTracker } from "@/lib/liveTracker";
import { useWorkspace } from "@/lib/workspace";

const configTiles = [
  "Moving update interval",
  "Stopped update interval",
  "Idle timeout",
  "Deep sleep timeout",
  "Wake on motion",
  "Wake on ignition",
  "Overnight parked mode",
  "Heartbeat interval",
  "Battery saver mode",
  "Data saver mode",
  "Firmware updates",
  "Diagnostics",
];

export default function DevicesPage() {
  const trackers = useAllTrackers();
  const { liveTracker } = useLiveTracker();
  const liveDevice = buildPrototypeDevice(liveTracker);
  const { state, assignTrackerToVehicle } = useWorkspace();

  const [pendingAssignments, setPendingAssignments] = useState<Record<string, string>>({});
  const [savedTrackers, setSavedTrackers] = useState<Set<string>>(new Set());

  const deviceKpis = [
    { label: "Online devices", value: String(trackers.length), icon: RadioTower },
    { label: "Pending firmware updates", value: "0", icon: Cpu },
    { label: "Profiles using smart sleep", value: "1", icon: Zap },
  ] as const;

  function currentVehicleId(trackerId: string) {
    return state.vehicles.find((v) => v.deviceAssignment === trackerId)?.id ?? "";
  }

  function currentVehicleName(trackerId: string) {
    return state.vehicles.find((v) => v.deviceAssignment === trackerId)?.name ?? "Not assigned";
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase text-brand-forest">Devices</p>
        <h1 className="mt-1 text-3xl font-bold text-brand-ink">Devices</h1>
        <p className="mt-2 text-sm text-slate-500">
          Review tracker health, assignment, and reporting behavior from one place.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {deviceKpis.map(({ label, value, icon: Icon }) => (
          <SectionCard key={label} className="p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-brand-mint p-3 text-brand-forest">
                <Icon size={18} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-bold text-brand-ink">{value}</p>
              </div>
            </div>
          </SectionCard>
        ))}
      </div>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-5">
          {trackers.length === 0 && (
            <SectionCard className="p-5">
              <p className="text-sm text-slate-500">No trackers online. Waiting for devices to check in.</p>
            </SectionCard>
          )}

          {trackers.map((tracker) => {
            const signalPct = Math.max(0, Math.min(100, Math.round(((tracker.cell_rssi ?? 0) / 31) * 100)));
            const battPct = Math.max(0, Math.min(100, Math.round((((tracker.battery_mv ?? 3600) - 3300) / 900) * 100)));
            const savedVehicleId = currentVehicleId(tracker.device_id);
            const savedVehicleName = currentVehicleName(tracker.device_id);
            const pendingVehicleId = pendingAssignments[tracker.device_id] ?? savedVehicleId;
            const isSaved = savedTrackers.has(tracker.device_id);

            return (
              <SectionCard key={tracker.device_id} className="overflow-hidden">
                <div className="border-b border-brand-line px-5 py-4">
                  <h3 className="text-base font-semibold text-brand-ink">
                    Tracker details — {tracker.device_id}
                  </h3>
                  <p className="text-sm text-slate-500">Live status from the last check-in.</p>
                </div>
                <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
                  {([
                    ["Device ID", tracker.device_id],
                    ["Assignment", savedVehicleName],
                    ["SIM", "1NCE SIM installed"],
                    ["Firmware", tracker.firmware ?? "0.1.0"],
                    ["Battery", `${battPct}%`],
                    ["Signal", `${signalPct}%`],
                    ["Location", tracker.has_fix ? "Available" : "Waiting for GPS"],
                    ["Motion", tracker.motion_state === "moving" ? "Moving" : "Stopped"],
                    ["Last update", tracker.received_at ?? "No updates yet"],
                  ] as [string, string][]).map(([label, value]) => (
                    <div key={label} className="rounded-md border border-brand-line bg-brand-cloud px-4 py-4">
                      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
                      <p className="mt-1 text-sm font-semibold text-brand-ink">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="border-t border-brand-line px-5 py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      className="h-10 min-w-[220px] rounded-md border border-brand-line bg-white px-3 text-sm"
                      value={pendingVehicleId}
                      onChange={(e) => {
                        setPendingAssignments((prev) => ({ ...prev, [tracker.device_id]: e.target.value }));
                        setSavedTrackers((prev) => {
                          const next = new Set(prev);
                          next.delete(tracker.device_id);
                          return next;
                        });
                      }}
                      disabled={state.vehicles.length === 0}
                    >
                      <option value="">Assign to vehicle</option>
                      {state.vehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="secondary"
                      disabled={state.vehicles.length === 0 || !pendingVehicleId}
                      onClick={() => {
                        assignTrackerToVehicle(pendingVehicleId, tracker.device_id);
                        setSavedTrackers((prev) => new Set(prev).add(tracker.device_id));
                      }}
                    >
                      Save Assignment
                    </Button>
                  </div>
                  {state.vehicles.length === 0 && (
                    <p className="mt-2 text-sm text-slate-500">
                      Add a vehicle first, then link a tracker here.
                    </p>
                  )}
                  {state.vehicles.length > 0 && !pendingVehicleId && (
                    <p className="mt-2 text-sm text-slate-500">
                      Choose the vehicle to assign {tracker.device_id} to.
                    </p>
                  )}
                  {isSaved && (
                    <p className="mt-2 text-sm text-brand-forest">Assignment saved.</p>
                  )}
                  {!isSaved && savedVehicleName !== "Not assigned" && (
                    <p className="mt-2 text-sm text-slate-500">
                      Currently assigned to: {savedVehicleName}.
                    </p>
                  )}
                </div>
              </SectionCard>
            );
          })}

          <SectionCard className="p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-brand-cloud p-3 text-brand-navy">
                <SlidersHorizontal size={18} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-brand-ink">Tracker Settings</h2>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                    Coming soon
                  </span>
                </div>
                <p className="text-sm text-slate-500">
                  Remote reporting and power settings — read-only for now.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {configTiles.map((tile) => (
                <div key={tile} className="rounded-md border border-brand-line px-4 py-4">
                  <p className="text-sm font-semibold text-brand-ink">{tile}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Keep installed trackers consistent across the fleet.
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
        <TrackingProfileCard device={liveDevice} />
      </div>
    </div>
  );
}
