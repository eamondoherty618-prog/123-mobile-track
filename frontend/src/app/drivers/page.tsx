"use client";

import { Award, ShieldAlert, UserRound } from "lucide-react";
import { useMemo, useState } from "react";

import { AddDriverModal } from "@/components/forms/AddDriverModal";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionCard } from "@/components/ui/SectionCard";
import { useAllAlerts, useAllTrips, kmToMiles } from "@/lib/fleetHistory";
import { useWorkspace } from "@/lib/workspace";

export default function DriversPage() {
  const { state } = useWorkspace();
  const [modalOpen, setModalOpen] = useState(false);

  // Collect all tracker IDs assigned to vehicles that have assigned drivers
  const deviceIds = useMemo(
    () => state.vehicles.map((v) => v.deviceAssignment).filter((d) => d && d !== "Not assigned") as string[],
    [state.vehicles],
  );

  const { trips } = useAllTrips(deviceIds);
  const { alerts } = useAllAlerts(deviceIds);

  // Build per-vehicle trip miles & events so we can attribute to driver
  const vehicleStats = useMemo(() => {
    const map: Record<string, { miles: number; events: number }> = {};
    for (const vehicle of state.vehicles) {
      if (!vehicle.deviceAssignment || vehicle.deviceAssignment === "Not assigned") continue;
      const vTrips = trips.filter((t) => t.device_id === vehicle.deviceAssignment);
      const vAlerts = alerts.filter((a) => a.device_id === vehicle.deviceAssignment);
      const miles = vTrips.reduce((sum, t) => sum + kmToMiles(t.distance_km), 0);
      map[vehicle.id] = { miles, events: vAlerts.length };
    }
    return map;
  }, [trips, alerts, state.vehicles]);

  // Map driver → vehicles for stats (many-to-many)
  const driverStats = useMemo(() => {
    const result: Record<string, { miles: number; events: number; eventsPerHundred: number; vehicleNames: string[] }> = {};
    for (const driver of state.drivers) {
      const assignedIds = driver.assignedVehicleIds?.length
        ? driver.assignedVehicleIds
        : state.vehicles.filter((v) => v.assignedDriver === driver.name).map((v) => v.id);
      if (assignedIds.length === 0) continue;
      let totalMiles = 0;
      let totalEvents = 0;
      const vehicleNames: string[] = [];
      for (const vId of assignedIds) {
        const vehicle = state.vehicles.find((v) => v.id === vId);
        if (!vehicle) continue;
        vehicleNames.push(vehicle.name);
        if (vehicleStats[vId]) {
          totalMiles += vehicleStats[vId].miles;
          totalEvents += vehicleStats[vId].events;
        }
      }
      result[driver.id] = {
        miles: totalMiles,
        events: totalEvents,
        eventsPerHundred: totalMiles > 0 ? (totalEvents / totalMiles) * 100 : 0,
        vehicleNames,
      };
    }
    return result;
  }, [state.drivers, state.vehicles, vehicleStats]);

  const hasScores = Object.keys(driverStats).length > 0;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase text-brand-forest">Drivers</p>
        <h1 className="mt-1 text-3xl font-bold text-brand-ink">Drivers</h1>
        <p className="mt-2 text-sm text-slate-500">
          Operator profiles, contact info, and driving behavior scorecards.
        </p>
      </div>

      {state.drivers.length === 0 ? (
        <EmptyState
          title="No drivers added"
          description="Add drivers whenever you want operator names, contact details, and regional assignments in the account."
          icon={<UserRound size={22} />}
          actionLabel="Add Driver"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        <>
          {/* Scorecards */}
          {hasScores && (
            <SectionCard>
              <div className="flex items-center gap-2 border-b border-brand-line px-5 py-4">
                <Award size={16} className="text-brand-navy" />
                <h2 className="text-base font-semibold text-brand-ink">Driver scorecards</h2>
                <span className="ml-auto text-xs text-slate-400">events per 100 miles (lower is better)</span>
              </div>
              <div className="divide-y divide-brand-line">
                {state.drivers
                  .filter((d) => driverStats[d.id])
                  .sort((a, b) => (driverStats[a.id]?.eventsPerHundred ?? 0) - (driverStats[b.id]?.eventsPerHundred ?? 0))
                  .map((driver, i) => {
                    const stats = driverStats[driver.id]!;
                    const score = stats.eventsPerHundred;
                    const grade =
                      score === 0 ? { label: "Excellent", color: "text-brand-forest", bar: "bg-brand-forest" }
                      : score < 2 ? { label: "Good", color: "text-blue-600", bar: "bg-blue-500" }
                      : score < 5 ? { label: "Fair", color: "text-amber-600", bar: "bg-amber-400" }
                      : { label: "Needs work", color: "text-red-600", bar: "bg-red-400" };

                    return (
                      <div key={driver.id} className="px-5 py-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-cloud text-xs font-bold text-brand-ink">
                              {i + 1}
                            </span>
                            <div>
                              <p className="font-semibold text-brand-ink">{driver.name}</p>
                              <p className="text-xs text-slate-400">{stats.vehicleNames.join(", ")}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-bold ${grade.color}`}>{grade.label}</p>
                            <p className="text-xs text-slate-400">{score.toFixed(1)} events/100 mi</p>
                          </div>
                        </div>
                        <div className="mt-2.5 flex items-center gap-3">
                          <div className="flex-1 h-1.5 rounded-full bg-brand-cloud overflow-hidden">
                            <div
                              className={`h-full rounded-full ${grade.bar} transition-all`}
                              style={{ width: `${Math.min(100, score * 10)}%` }}
                            />
                          </div>
                          <div className="flex gap-4 text-xs text-slate-500 shrink-0">
                            <span>{Math.round(stats.miles)} mi</span>
                            <span className="flex items-center gap-1">
                              <ShieldAlert size={11} /> {stats.events}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </SectionCard>
          )}

          <SectionCard className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-brand-line px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-brand-ink">Drivers</h2>
                <p className="text-sm text-slate-500">{state.drivers.length} in this account</p>
              </div>
              <Button onClick={() => setModalOpen(true)}>Add Driver</Button>
            </div>
            <div className="grid gap-3 p-5 md:grid-cols-2">
              {state.drivers.map((driver) => (
                <div key={driver.id} className="rounded-md border border-brand-line bg-brand-cloud px-4 py-4">
                  <p className="font-semibold text-brand-ink">{driver.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{driver.phone}</p>
                  <p className="mt-3 text-sm text-brand-text">License: {driver.license}</p>
                  {driverStats[driver.id]?.vehicleNames.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {driverStats[driver.id].vehicleNames.map((name) => (
                        <span key={name} className="rounded-full bg-white border border-brand-line px-2 py-0.5 text-xs text-slate-600">{name}</span>
                      ))}
                    </div>
                  )}
                  {driverStats[driver.id] && (
                    <div className="mt-2 flex gap-3 text-xs text-slate-400">
                      <span>{Math.round(driverStats[driver.id].miles)} mi driven</span>
                      <span>{driverStats[driver.id].events} alerts</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>
        </>
      )}
      <AddDriverModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
