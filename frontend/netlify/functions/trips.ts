import type { Config } from "@netlify/functions";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

type TelemetryEvent = {
  device_id: string;
  received_at: string;
  has_fix?: boolean;
  motion_state?: string;
  gps?: { lat?: number | string; lon?: number | string; speed_kph?: number | string };
  event?: string;
};

type TripEvent = { type: string; time: string; lat: number; lon: number; speed_kph: number };

type Trip = {
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
  route?: { lat: number; lon: number; speed_kph: number; time: string; motion_state: string }[];
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const TRIP_GAP_MS = 5 * 60 * 1000;   // 5-minute gap ends a trip
const MIN_TRIP_DURATION_S = 60;       // ignore sub-1-minute trips
const MIN_MOVING_KPH = 4;

function buildTrips(events: TelemetryEvent[], includeRoute: boolean): Trip[] {
  const withFix = events
    .filter((e) => e.has_fix && e.gps?.lat != null && e.gps?.lon != null)
    .map((e) => ({
      time: new Date(e.received_at).getTime(),
      iso: e.received_at,
      lat: Number(e.gps!.lat),
      lon: Number(e.gps!.lon),
      speed: Number(e.gps?.speed_kph ?? 0),
      motion: e.motion_state ?? "unknown",
      event: e.event ?? null,
      device_id: e.device_id,
    }))
    .sort((a, b) => a.time - b.time);

  const trips: Trip[] = [];
  let pts: typeof withFix = [];

  const flush = () => {
    if (pts.length < 2) { pts = []; return; }
    const dur = (pts[pts.length - 1].time - pts[0].time) / 1000;
    if (dur < MIN_TRIP_DURATION_S) { pts = []; return; }

    let dist = 0;
    let maxSpeed = 0;
    let speedSum = 0;
    const tripEvents: TripEvent[] = [];

    for (let i = 1; i < pts.length; i++) {
      dist += haversineKm(pts[i - 1].lat, pts[i - 1].lon, pts[i].lat, pts[i].lon);
      if (pts[i].speed > maxSpeed) maxSpeed = pts[i].speed;
      speedSum += pts[i].speed;
      if (pts[i].event) {
        tripEvents.push({ type: pts[i].event!, time: pts[i].iso, lat: pts[i].lat, lon: pts[i].lon, speed_kph: pts[i].speed });
      }
    }

    const trip: Trip = {
      id: `trip-${pts[0].iso}-${pts[0].device_id}`,
      device_id: pts[0].device_id,
      start_time: pts[0].iso,
      end_time: pts[pts.length - 1].iso,
      duration_s: Math.round(dur),
      distance_km: Math.round(dist * 100) / 100,
      max_speed_kph: Math.round(maxSpeed),
      avg_speed_kph: Math.round(speedSum / (pts.length - 1)),
      point_count: pts.length,
      event_count: tripEvents.length,
      events: tripEvents,
      start_lat: pts[0].lat,
      start_lon: pts[0].lon,
      end_lat: pts[pts.length - 1].lat,
      end_lon: pts[pts.length - 1].lon,
    };
    if (includeRoute) {
      trip.route = pts.map((p) => ({ lat: p.lat, lon: p.lon, speed_kph: p.speed, time: p.iso, motion_state: p.motion }));
    }
    trips.push(trip);
    pts = [];
  };

  for (let i = 0; i < withFix.length; i++) {
    const p = withFix[i];
    if (p.speed < MIN_MOVING_KPH && p.motion !== "moving") {
      if (pts.length > 0) flush();
      continue;
    }
    if (pts.length > 0) {
      const gap = p.time - withFix[i - 1].time;
      if (gap > TRIP_GAP_MS) flush();
    }
    pts.push(p);
  }
  flush();

  return trips.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
}

export default async (req: Request) => {
  const url = new URL(req.url);
  const deviceId = url.searchParams.get("device_id") ?? "";
  if (!deviceId) return json({ ok: false, error: "device_id required" }, 400);

  // Detect detail request: /api/fleet/trips/TRIPID
  const segments = url.pathname.split("/").filter(Boolean);
  const tripId = segments[segments.length - 1] !== "trips" ? segments[segments.length - 1] : null;

  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name: "fleet-telemetry", consistency: "strong" });

  // Fetch up to 500 most-recent device events
  const { blobs } = await store.list({ prefix: `device-events/${deviceId}/` });
  const recent = blobs.slice(-500);
  const records = (await Promise.all(
    recent.map((b) => store.get(b.key, { type: "json" }) as Promise<TelemetryEvent | null>)
  )).filter((r): r is TelemetryEvent => r !== null);

  if (tripId) {
    // Trip detail — find the specific trip and return its route
    const all = buildTrips(records, true);
    const trip = all.find((t) => t.id === tripId);
    if (!trip) return json({ ok: false, error: "not found" }, 404);
    const { route, ...summary } = trip;
    return json({ ok: true, trip: summary, route: route ?? [] });
  }

  const trips = buildTrips(records, false);
  return json({ ok: true, trips });
};

export const config: Config = {
  path: ["/api/fleet/trips", "/api/fleet/trips/:tripId"],
  method: ["GET"],
};
