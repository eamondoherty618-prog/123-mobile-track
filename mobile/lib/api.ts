const BASE = "https://123mobiletrack.com";

async function get<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function post<T>(path: string, token: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

// ── Types ────────────────────────────────────────────────────────────────────

export type TrackerPacket = {
  device_id: string;
  has_fix?: boolean;
  fix_source?: string;
  gps?: { lat?: number | string; lon?: number | string; speed_kph?: number | string };
  last_gps?: { lat: number | string; lon: number | string; time?: string };
  motion_state?: string;
  battery_mv?: number;
  cell_rssi?: number;
  firmware?: string;
  received_at?: string;
};

export type Vehicle = {
  id: string;
  name: string;
  deviceAssignment?: string;
  plate?: string;
  make?: string;
  model?: string;
  year?: number;
  photo?: string;
};

export type Trip = {
  id: string;
  device_id: string;
  start_time: string;
  end_time: string;
  duration_s: number;
  distance_km: number;
  max_speed_kph: number;
  avg_speed_kph: number;
  point_count: number;
  start_lat: number;
  start_lon: number;
  end_lat: number;
  end_lon: number;
};

export type FleetAlert = {
  id: string;
  device_id: string;
  type: string;
  title: string;
  severity: "critical" | "warning" | "info";
  time: string;
  speed_kph?: number;
  lat?: number;
  lon?: number;
};

export type Workspace = {
  vehicles: Vehicle[];
  geofences: unknown[];
  wifiShortcuts?: unknown[];
};

// ── API calls ────────────────────────────────────────────────────────────────

export async function fetchLatest(token: string) {
  return get<{ ok: boolean; devices: Record<string, TrackerPacket> }>("/api/fleet/latest", token);
}

export async function fetchWorkspace(token: string) {
  return get<{ ok: boolean; workspace: Workspace | null }>("/api/workspace", token);
}

export async function fetchTrips(token: string, deviceId: string) {
  return get<{ ok: boolean; trips: Trip[] }>(`/api/fleet/trips?device_id=${deviceId}`, token);
}

export async function fetchAlerts(token: string, deviceId: string) {
  return get<{ ok: boolean; alerts: FleetAlert[] }>(`/api/fleet/alerts?device_id=${deviceId}`, token);
}

export async function fetchPendingDevices(token: string) {
  return get<{ ok: boolean; pending: { hardware_id: string; created_at: string }[] }>(
    "/api/fleet/provision/pending",
    token,
  );
}

export async function claimDevice(
  token: string,
  hardware_id: string,
  opts: { vehicle_id?: string; device_name?: string },
) {
  return post<{ ok: boolean; device_id?: string; error?: string }>(
    "/api/fleet/provision/claim",
    token,
    { hardware_id, ...opts },
  );
}
