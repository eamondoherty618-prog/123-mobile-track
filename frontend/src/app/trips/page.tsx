"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Download, Route } from "lucide-react";

import { SectionCard } from "@/components/ui/SectionCard";
import {
  fetchTripDetail,
  formatDate,
  formatDuration,
  formatTime,
  kmToMiles,
  kphToMph,
  useAllTrips,
  type RoutePoint,
  type TripSummary,
} from "@/lib/fleetHistory";
import { useGeocode } from "@/lib/geocode";
import { useWorkspace } from "@/lib/workspace";

const TripRouteMapClient = dynamic(
  () => import("@/components/map/TripRouteMapClient"),
  { ssr: false, loading: () => <div className="h-48 animate-pulse rounded-lg bg-brand-cloud" /> },
);

const EVENT_LABEL: Record<string, string> = {
  hard_brake: "Hard brake",
  rapid_accel: "Rapid accel",
  speeding: "Speeding",
};

const EVENT_COLOR: Record<string, string> = {
  hard_brake: "bg-red-100 text-red-700 border-red-200",
  rapid_accel: "bg-amber-100 text-amber-700 border-amber-200",
  speeding: "bg-orange-100 text-orange-700 border-orange-200",
};

function TripRow({
  trip,
  vehicleName,
}: {
  trip: TripSummary;
  vehicleName: string;
}) {
  const [open, setOpen] = useState(false);
  const [route, setRoute] = useState<RoutePoint[] | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);

  const fromLabel = useGeocode(trip.start_lat, trip.start_lon);
  const toLabel = useGeocode(trip.end_lat, trip.end_lon);

  async function toggle() {
    if (!open && route === null) {
      setLoadingRoute(true);
      try {
        const detail = await fetchTripDetail(trip.id, trip.device_id);
        setRoute(detail.route);
      } catch {
        setRoute([]);
      } finally {
        setLoadingRoute(false);
      }
    }
    setOpen((v) => !v);
  }

  const uniqueEventTypes = [...new Set(trip.events.map((e) => e.type))];
  const isSameLocation = fromLabel !== "…" && toLabel !== "…" && fromLabel === toLabel;

  return (
    <div className="border-t border-brand-line">
      <button
        onClick={toggle}
        className="flex w-full items-start gap-4 px-5 py-4 text-left hover:bg-brand-cloud/60 transition-colors"
      >
        <div className="flex-1 min-w-0">
          {/* Route label */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="rounded-md bg-brand-cloud px-2 py-0.5 text-xs font-semibold text-brand-navy">
              {vehicleName}
            </span>
            <span className="text-sm font-semibold text-brand-ink">
              {isSameLocation ? fromLabel : `${fromLabel} → ${toLabel}`}
            </span>
          </div>
          {/* Date + time + event badges */}
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400">
              {formatDate(trip.start_time)} · {formatTime(trip.start_time)}–{formatTime(trip.end_time)}
            </span>
            {uniqueEventTypes.map((t) => (
              <span
                key={t}
                className={`rounded-full border px-2 py-0.5 text-xs font-medium ${EVENT_COLOR[t] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}
              >
                {EVENT_LABEL[t] ?? t}
              </span>
            ))}
          </div>
        </div>

        <div className="hidden sm:flex gap-5 text-sm text-slate-500 shrink-0 pt-0.5">
          <span>{kmToMiles(trip.distance_km).toFixed(1)} mi</span>
          <span>{formatDuration(trip.duration_s)}</span>
          <span>max {Math.round(kphToMph(trip.max_speed_kph))} mph</span>
        </div>
        <span className="text-slate-400 shrink-0 pt-1">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4">
          {!isSameLocation && (
            <p className="text-sm text-slate-500">
              {fromLabel} → {toLabel}
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <Stat label="Distance" value={`${kmToMiles(trip.distance_km).toFixed(2)} mi`} />
            <Stat label="Duration" value={formatDuration(trip.duration_s)} />
            <Stat label="Max speed" value={`${Math.round(kphToMph(trip.max_speed_kph))} mph`} />
            <Stat label="Avg speed" value={`${Math.round(kphToMph(trip.avg_speed_kph))} mph`} />
          </div>

          {loadingRoute && <div className="h-48 animate-pulse rounded-lg bg-brand-cloud" />}
          {route !== null && !loadingRoute && <TripRouteMapClient route={route} />}

          {trip.events.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400 mb-2">Events</p>
              <div className="space-y-1">
                {trip.events.map((ev, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs text-slate-600">
                    <span className={`rounded-full border px-2 py-0.5 font-medium ${EVENT_COLOR[ev.type] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                      {EVENT_LABEL[ev.type] ?? ev.type}
                    </span>
                    <span>{formatTime(ev.time)}</span>
                    {ev.speed_kph > 0 && <span>{Math.round(kphToMph(ev.speed_kph))} mph</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-brand-cloud px-3 py-2">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-brand-ink">{value}</p>
    </div>
  );
}

export default function TripsPage() {
  const { state } = useWorkspace();
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  const assignedVehicles = useMemo(
    () => state.vehicles.filter((v) => v.deviceAssignment && v.deviceAssignment !== "Not assigned"),
    [state.vehicles],
  );

  const deviceIds = useMemo(
    () => assignedVehicles.map((v) => v.deviceAssignment),
    [assignedVehicles],
  );

  const deviceToVehicleName = useMemo(
    () => Object.fromEntries(assignedVehicles.map((v) => [v.deviceAssignment, v.name])),
    [assignedVehicles],
  );

  const { trips, loading, error } = useAllTrips(deviceIds);

  const filteredTrips = useMemo(() => {
    if (!selectedVehicleId) return trips;
    const vehicle = assignedVehicles.find((v) => v.id === selectedVehicleId);
    if (!vehicle) return trips;
    return trips.filter((t) => t.device_id === vehicle.deviceAssignment);
  }, [trips, selectedVehicleId, assignedVehicles]);

  function exportCsv() {
    const rows = [
      ["Vehicle", "Date", "Start time", "Duration", "Miles", "Max speed (mph)", "Avg speed (mph)", "Events"].join(","),
      ...filteredTrips.map((t) => [
        `"${deviceToVehicleName[t.device_id] ?? t.device_id}"`,
        formatDate(t.start_time),
        formatTime(t.start_time),
        formatDuration(t.duration_s),
        kmToMiles(t.distance_km).toFixed(1),
        Math.round(kphToMph(t.max_speed_kph)),
        Math.round(kphToMph(t.avg_speed_kph)),
        t.event_count,
      ].join(",")),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `trips-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase text-brand-forest">Trips</p>
          <h1 className="mt-1 text-3xl font-bold text-brand-ink">Trips</h1>
          <p className="mt-2 text-sm text-slate-500">
            Route history, mileage, and driving events across all vehicles.
          </p>
        </div>
        {filteredTrips.length > 0 && (
          <button
            onClick={exportCsv}
            className="mt-1 flex shrink-0 items-center gap-1.5 rounded-lg border border-brand-line bg-white px-3 py-2 text-sm font-medium text-brand-ink transition hover:bg-brand-cloud"
          >
            <Download size={14} />
            Export CSV
          </button>
        )}
      </div>

      {/* Vehicle filter tabs */}
      {assignedVehicles.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedVehicleId(null)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              selectedVehicleId === null
                ? "bg-brand-navy text-white"
                : "bg-brand-cloud text-brand-text hover:bg-brand-line"
            }`}
          >
            All vehicles
          </button>
          {assignedVehicles.map((v) => (
            <button
              key={v.id}
              onClick={() => setSelectedVehicleId(v.id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                selectedVehicleId === v.id
                  ? "bg-brand-navy text-white"
                  : "bg-brand-cloud text-brand-text hover:bg-brand-line"
              }`}
            >
              {v.name}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <SectionCard className="p-8 text-center text-sm text-slate-400">
          Loading trips…
        </SectionCard>
      )}

      {error && (
        <SectionCard className="p-5 text-sm text-red-600">
          Could not load trips: {error}
        </SectionCard>
      )}

      {!loading && !error && deviceIds.length === 0 && (
        <SectionCard className="p-8 text-center">
          <Route size={22} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-semibold text-brand-ink">No trackers assigned</p>
          <p className="mt-1 text-sm text-slate-500">
            Go to Devices and assign a tracker to a vehicle to start logging trips.
          </p>
        </SectionCard>
      )}

      {!loading && !error && deviceIds.length > 0 && filteredTrips.length === 0 && (
        <SectionCard className="p-8 text-center">
          <Route size={22} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-semibold text-brand-ink">No trips recorded yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Trips appear after a tracker gets a GPS fix and starts moving.
          </p>
        </SectionCard>
      )}

      {!loading && filteredTrips.length > 0 && (
        <SectionCard className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-brand-line px-5 py-4">
            <div>
              <h3 className="text-base font-semibold text-brand-ink">Trip log</h3>
              <p className="text-sm text-slate-500">
                {filteredTrips.length} trip{filteredTrips.length !== 1 ? "s" : ""} — click to expand route and events
              </p>
            </div>
          </div>
          {filteredTrips.map((trip) => (
            <TripRow
              key={trip.id}
              trip={trip}
              vehicleName={deviceToVehicleName[trip.device_id] ?? trip.device_id}
            />
          ))}
        </SectionCard>
      )}
    </div>
  );
}
