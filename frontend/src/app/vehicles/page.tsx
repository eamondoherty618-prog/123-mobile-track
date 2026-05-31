"use client";

import { CarFront, CheckCircle2, TriangleAlert, Wrench } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { AddVehicleModal } from "@/components/forms/AddVehicleModal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionCard } from "@/components/ui/SectionCard";
import { useWorkspace } from "@/lib/workspace";

export default function VehiclesPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const { state } = useWorkspace();

  const now = Date.now();

  // Same dedup as dashboard: hide placeholder vehicles whose name is a claimed device ID
  const claimedDeviceIds = useMemo(
    () =>
      new Set(
        state.vehicles
          .map((v) => v.deviceAssignment)
          .filter((id): id is string => Boolean(id) && id !== "Not assigned"),
      ),
    [state.vehicles],
  );

  const visibleVehicles = useMemo(
    () =>
      state.vehicles.filter((v) => {
        const isUnassigned = !v.deviceAssignment || v.deviceAssignment === "Not assigned";
        if (!isUnassigned) return true;
        return !claimedDeviceIds.has(v.name) && !claimedDeviceIds.has(v.id);
      }),
    [state.vehicles, claimedDeviceIds],
  );

  const maintSummary = useMemo(() => {
    const dueIds = new Set<string>();
    const upcomingIds = new Set<string>();
    for (const item of state.maintenanceItems) {
      if (!item.alertEnabled || item.intervalMonths === 0) continue;
      const monthsSince = (now - new Date(item.lastServiceDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
      if (monthsSince >= item.intervalMonths) dueIds.add(item.vehicleId);
      else if (monthsSince >= item.intervalMonths * 0.85) upcomingIds.add(item.vehicleId);
    }
    return { dueIds, upcomingIds };
  }, [state.maintenanceItems, now]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase text-brand-forest">Vehicles</p>
          <h1 className="mt-1 text-3xl font-bold text-brand-ink">Vehicles</h1>
          <p className="mt-2 text-sm text-slate-500">
            Add vehicles, keep records organized, and link each one to a tracker when it is ready.
          </p>
        </div>
        {visibleVehicles.length > 0 && (
          <Button onClick={() => setModalOpen(true)} className="shrink-0">Add Vehicle</Button>
        )}
      </div>

      {visibleVehicles.length === 0 ? (
        <EmptyState
          title="No vehicles yet"
          description="Add the first vehicle to start building your live fleet registry."
          actionLabel="Add First Vehicle"
          onAction={() => setModalOpen(true)}
          icon={<CarFront size={22} />}
        />
      ) : (
        <>
          {/* Maintenance summary strip — visible when items are due */}
          {(maintSummary.dueIds.size > 0 || maintSummary.upcomingIds.size > 0) && (
            <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${
              maintSummary.dueIds.size > 0
                ? "border-red-200 bg-red-50"
                : "border-amber-200 bg-amber-50"
            }`}>
              <Wrench size={16} className={maintSummary.dueIds.size > 0 ? "text-red-500 shrink-0" : "text-amber-500 shrink-0"} />
              <p className={`text-sm font-medium ${maintSummary.dueIds.size > 0 ? "text-red-700" : "text-amber-700"}`}>
                {maintSummary.dueIds.size > 0
                  ? `${maintSummary.dueIds.size} vehicle${maintSummary.dueIds.size !== 1 ? "s have" : " has"} maintenance overdue`
                  : `${maintSummary.upcomingIds.size} vehicle${maintSummary.upcomingIds.size !== 1 ? "s have" : " has"} maintenance due soon`}
              </p>
              <Link href="/maintenance" className="ml-auto shrink-0 text-xs font-medium text-brand-navy hover:underline">
                View →
              </Link>
            </div>
          )}

          {/* Vehicle cards */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleVehicles.map((vehicle) => {
              const isDue = maintSummary.dueIds.has(vehicle.id);
              const isUpcoming = !isDue && maintSummary.upcomingIds.has(vehicle.id);
              const dueItems = state.maintenanceItems.filter((m) => {
                if (m.vehicleId !== vehicle.id || !m.alertEnabled || m.intervalMonths === 0) return false;
                const ms = (now - new Date(m.lastServiceDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
                return ms >= m.intervalMonths;
              });

              return (
                <Link key={vehicle.id} href={`/vehicles/${vehicle.id}`}>
                  <SectionCard className="p-4 hover:shadow-md transition-shadow cursor-pointer h-full">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-brand-ink truncate">{vehicle.name}</p>
                        <p className="text-xs text-slate-500 truncate">
                          {[vehicle.make, vehicle.model, String(vehicle.year)].filter(Boolean).join(" ")}
                          {vehicle.plate ? ` · ${vehicle.plate}` : ""}
                        </p>
                      </div>
                      <Badge tone={vehicle.deviceStatus} className="shrink-0">{vehicle.deviceStatus}</Badge>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {vehicle.deviceAssignment && vehicle.deviceAssignment !== "Not assigned" ? (
                        <span className="rounded-full bg-brand-cloud border border-brand-line px-2 py-0.5 text-xs font-mono text-slate-600">
                          {vehicle.deviceAssignment}
                        </span>
                      ) : (
                        <span className="rounded-full border border-brand-line px-2 py-0.5 text-xs text-slate-400">
                          No tracker
                        </span>
                      )}
                      {isDue && (
                        <span className="flex items-center gap-1 rounded-full bg-red-100 border border-red-200 px-2 py-0.5 text-xs font-medium text-red-600">
                          <TriangleAlert size={10} />
                          {dueItems.length} maintenance due
                        </span>
                      )}
                      {isUpcoming && (
                        <span className="flex items-center gap-1 rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-600">
                          <Wrench size={10} />
                          Due soon
                        </span>
                      )}
                    </div>

                    {/* Maintenance items preview */}
                    {dueItems.length > 0 && (
                      <div className="mt-3 space-y-1 border-t border-brand-line pt-3">
                        {dueItems.slice(0, 2).map((item) => (
                          <div key={item.id} className="flex items-center gap-1.5 text-xs text-red-600">
                            <TriangleAlert size={10} />
                            {item.label} overdue
                          </div>
                        ))}
                        {dueItems.length > 2 && (
                          <p className="text-xs text-slate-400">+{dueItems.length - 2} more</p>
                        )}
                      </div>
                    )}

                    {(!isDue && !isUpcoming) && (
                      <div className="mt-3 flex items-center justify-end text-xs border-t border-brand-line pt-3">
                        <span className="flex items-center gap-1 text-brand-forest">
                          <CheckCircle2 size={11} /> Maintenance OK
                        </span>
                      </div>
                    )}
                  </SectionCard>
                </Link>
              );
            })}
          </div>
        </>
      )}

      <AddVehicleModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
