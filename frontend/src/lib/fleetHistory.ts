"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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
        const { data, error: err } = await supabase
          .from("trips")
          .select("*")
          .eq("device_id", deviceId)
          .order("start_time", { ascending: false });
        if (err) throw err;
        if (!cancelled) { setTrips((data ?? []) as TripSummary[]); setError(null); }
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

export async function fetchTripDetail(tripId: string): Promise<TripDetail> {
  const { data, error } = await supabase
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .single();
  if (error) throw new Error(error.message);
  return { trip: data as TripSummary, route: (data.route ?? []) as RoutePoint[] };
}

export function useAlerts(deviceId: string) {
  const [alerts, setAlerts] = useState<FleetAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (document.hidden) return;
      try {
        const { data, error: err } = await supabase
          .from("alerts")
          .select("*")
          .eq("device_id", deviceId)
          .order("time", { ascending: false });
        if (err) throw err;
        if (!cancelled) { setAlerts((data ?? []) as FleetAlert[]); setError(null); }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load alerts");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    function onVisible() { if (!document.hidden) load(); }

    load();
    const iv = window.setInterval(load, 120000);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(iv);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [deviceId]);

  return { alerts, loading, error };
}

export function useAllTrips(deviceIds: string[]) {
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = deviceIds.join(",");

  useEffect(() => {
    if (deviceIds.length === 0) { setTrips([]); setLoading(false); return; }
    let cancelled = false;
    async function load() {
      try {
        const { data, error: err } = await supabase
          .from("trips")
          .select("*")
          .in("device_id", deviceIds)
          .order("start_time", { ascending: false });
        if (err) throw err;
        if (!cancelled) { setTrips((data ?? []) as TripSummary[]); setError(null); }
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
    supabase
      .from("trips")
      .select("distance_km")
      .eq("device_id", deviceId)
      .gte("start_time", sinceDate)
      .then(({ data }) => {
        if (cancelled) return;
        const total = (data ?? []).reduce((s, t) => s + kmToMiles(t.distance_km ?? 0), 0);
        setMiles(Math.round(total));
      })
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
    if (deviceIds.length === 0) { setAlerts([]); setLoading(false); return; }
    let cancelled = false;

    async function load() {
      if (document.hidden) return;
      try {
        const { data, error: err } = await supabase
          .from("alerts")
          .select("*")
          .in("device_id", deviceIds)
          .order("time", { ascending: false });
        if (err) throw err;
        if (!cancelled) { setAlerts((data ?? []) as FleetAlert[]); setError(null); }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load alerts");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    function onVisible() { if (!document.hidden) load(); }

    load();
    const iv = window.setInterval(load, 120000);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(iv);
      document.removeEventListener("visibilitychange", onVisible);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

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
