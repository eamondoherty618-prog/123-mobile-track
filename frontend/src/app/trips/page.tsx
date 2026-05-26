"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { ChevronDown, ChevronUp, Route } from "lucide-react";

import { SectionCard } from "@/components/ui/SectionCard";
import {
  fetchTripDetail,
  formatDate,
  formatDuration,
  formatTime,
  type RoutePoint,
  type TripSummary,
  useTrips,
} from "@/lib/fleetHistory";

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

function TripRow({ trip }: { trip: TripSummary }) {
  const [open, setOpen] = useState(false);
  const [route, setRoute] = useState<RoutePoint[] | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);

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

  return (
    <div className="border-t border-brand-line">
      <button
        onClick={toggle}
        className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-brand-cloud/60 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-brand-ink">
              {formatDate(trip.start_time)}
            </span>
            <span className="text-xs text-slate-400">
              {formatTime(trip.start_time)} → {formatTime(trip.end_time)}
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
        <div className="hidden sm:flex gap-6 text-sm text-slate-500 shrink-0">
          <span>{trip.distance_km.toFixed(1)} km</span>
          <span>{formatDuration(trip.duration_s)}</span>
          <span>max {trip.max_speed_kph} kph</span>
        </div>
        <span className="text-slate-400 shrink-0">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <Stat label="Distance" value={`${trip.distance_km.toFixed(2)} km`} />
            <Stat label="Duration" value={formatDuration(trip.duration_s)} />
            <Stat label="Max speed" value={`${trip.max_speed_kph} kph`} />
            <Stat label="Avg speed" value={`${trip.avg_speed_kph} kph`} />
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
                    {ev.speed_kph > 0 && <span>{ev.speed_kph} kph</span>}
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
  const { trips, loading, error } = useTrips("tracker-001");

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase text-brand-forest">Trips</p>
        <h1 className="mt-1 text-3xl font-bold text-brand-ink">Trips</h1>
        <p className="mt-2 text-sm text-slate-500">
          Route history, mileage, and driving events logged by tracker-001.
        </p>
      </div>

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

      {!loading && !error && trips.length === 0 && (
        <SectionCard className="p-8 text-center">
          <Route size={22} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-semibold text-brand-ink">No trips recorded yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Trips appear after the tracker gets a GPS fix and starts moving.
          </p>
        </SectionCard>
      )}

      {!loading && trips.length > 0 && (
        <SectionCard className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-brand-line px-5 py-4">
            <div>
              <h3 className="text-base font-semibold text-brand-ink">Trip log</h3>
              <p className="text-sm text-slate-500">{trips.length} trip{trips.length !== 1 ? "s" : ""} — click to expand route and events</p>
            </div>
          </div>
          {trips.map((trip) => (
            <TripRow key={trip.id} trip={trip} />
          ))}
        </SectionCard>
      )}
    </div>
  );
}
