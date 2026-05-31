"use client";

import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export type TripEvent = {
  type: "hard_brake" | "rapid_accel" | "speeding";
  time: string;
  lat: number;
  lon: number;
  speed_kph: number;
};

export type TripSummary = {
  id: string;
  device_id: string;
  start_time: string;
  end_time: string;
  duration_s: number;
  distance_km: number;
  max_speed_kph: number;
  avg_speed_kph: number;
  point_count: number;
  event_count: number;
  events: TripEvent[];
  start_lat: number;
  start_lon: number;
  end_lat: number;
  end_lon: number;
};

export type RoutePoint = {
  lat: number;
  lon: number;
  speed_kph: number;
  time: string;
  motion_state: string;
};

export type TripDetail = {
  trip: TripSummary;
  route: RoutePoint[];
};

export type FleetAlert = {
  id: string;
  device_id: string;
  type: string;
  title: string;
  severity: "critical" | "warning" | "info";
  time: string;
  speed_kph: number;
  lat: number | null;
  lon: number | null;
};

export function useTrips(deviceId: string) {
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/fleet/trips?device_id=${deviceId}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { ok: boolean; trips: TripSummary[] };
        if (!cancelled) {
          setTrips(data.trips ?? []);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load trips");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [deviceId]);

  return { trips, loading, error };
}

export async function fetchTripDetail(tripId: string, deviceId: string): Promise<TripDetail> {
  const res = await fetch(`${API_BASE}/api/fleet/trips/${tripId}?device_id=${deviceId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as { ok: boolean; trip: TripSummary; route: RoutePoint[] };
  return { trip: data.trip, route: data.route };
}

export function useAlerts(deviceId: string) {
  const [alerts, setAlerts] = useState<FleetAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/fleet/alerts?device_id=${deviceId}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { ok: boolean; alerts: FleetAlert[] };
        if (!cancelled) {
          setAlerts(data.alerts ?? []);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load alerts");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    function onVisible() {
      if (!document.hidden) load();
    }
    load();
    const iv = window.setInterval(load, 120000);
    document.addEventListener("visibilitychange", onVisible);
    return () => { cancelled = true; window.clearInterval(iv); document.removeEventListener("visibilitychange", onVisible); };
  }, [deviceId]);

  return { alerts, loading, error };
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatTime(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export function kmToMiles(km: number): number {
  return km * 0.621371;
}

export function kphToMph(kph: number): number {
  return kph * 0.621371;
}

export function useAllTrips(deviceIds: string[]) {
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = deviceIds.join(",");

  useEffect(() => {
    if (deviceIds.length === 0) {
      setTrips([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const results = await Promise.all(
          deviceIds.map((id) =>
            fetch(`${API_BASE}/api/fleet/trips?device_id=${id}`, { cache: "no-store" })
              .then((r) => r.json() as Promise<{ ok: boolean; trips: TripSummary[] }>)
          )
        );
        if (!cancelled) {
          const all = results.flatMap((r) => r.trips ?? []);
          all.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
          setTrips(all);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load trips");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { trips, loading, error };
}

/** Sum GPS miles driven for a device since a given ISO date. */
export function useTripMilesSince(
  deviceId: string | undefined,
  sinceDate: string | undefined,
): { miles: number; loading: boolean } {
  const [miles, setMiles] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!deviceId || !sinceDate) { setMiles(0); return; }
    let cancelled = false;
    setLoading(true);
    const since = new Date(sinceDate).getTime();
    fetch(`${API_BASE}/api/fleet/trips?device_id=${deviceId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { ok: boolean; trips: TripSummary[] }) => {
        if (cancelled) return;
        const total = (data.trips ?? [])
          .filter((t) => new Date(t.start_time).getTime() >= since)
          .reduce((sum, t) => sum + kmToMiles(t.distance_km), 0);
        setMiles(Math.round(total));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [deviceId, sinceDate]);

  return { miles, loading };
}

export function useAllAlerts(deviceIds: string[]) {
  const [alerts, setAlerts] = useState<FleetAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = deviceIds.join(",");

  useEffect(() => {
    if (deviceIds.length === 0) {
      setAlerts([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const results = await Promise.all(
          deviceIds.map((id) =>
            fetch(`${API_BASE}/api/fleet/alerts?device_id=${id}`, { cache: "no-store" })
              .then((r) => r.json() as Promise<{ ok: boolean; alerts: FleetAlert[] }>)
          )
        );
        if (!cancelled) {
          const all = results.flatMap((r) => r.alerts ?? []);
          all.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
          setAlerts(all);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load alerts");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    function onVisible() {
      if (!document.hidden) load();
    }
    load();
    const iv = window.setInterval(load, 120000);
    document.addEventListener("visibilitychange", onVisible);
    return () => { cancelled = true; window.clearInterval(iv); document.removeEventListener("visibilitychange", onVisible); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { alerts, loading, error };
}
