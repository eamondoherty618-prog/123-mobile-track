import type { Config, Context } from "@netlify/functions";
import webpush from "web-push";

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_EMAIL = "mailto:ops@123mobiletrack.com";
const DEFAULT_SPEEDING_MPH = 75;

type GpsPayload = {
  lat?: number | string;
  lon?: number | string;
  speed_kph?: number | string;
  timestamp?: string;
};

type WifiScanEntry = { ssid?: string; bssid: string; rssi?: number };

type TelemetryPayload = Record<string, unknown> & {
  device_id?: string;
  gps?: GpsPayload;
  motion_state?: string;
  has_fix?: boolean;
  battery_mv?: number;
  cell_rssi?: number;
  firmware?: string;
  wifi_scan?: WifiScanEntry[];
  fix_source?: string;
};

type OtaMetadata = { version: string; size: number; uploaded_at: string };

function semverGt(a: string, b: string): boolean {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return true;
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return false;
  }
  return false;
}

type Geofence = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  radiusM: number;
  triggerOn: "enter" | "exit" | "both";
  alertEnabled: boolean;
};

type WifiShortcut = { id: string; ssids?: string[]; ssid?: string; lat: number; lon: number; label?: string };

type VehicleAlertThresholds = {
  speedingMph?: number;
  hardBrakeEnabled?: boolean;
  rapidAccelEnabled?: boolean;
  gpsOfflineMinutes?: number;
};

type WorkspaceState = {
  vehicles?: { id: string; deviceAssignment?: string; alertThresholds?: VehicleAlertThresholds }[];
  geofences?: Geofence[];
  wifiShortcuts?: WifiShortcut[];
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

async function isAuthorized(req: Request): Promise<boolean> {
  const master = process.env.TRACKER_API_KEY;
  const key =
    req.headers.get("x-tracker-key") ??
    new URL(req.url).searchParams.get("k") ??
    "";

  // Master key (legacy + current hardcoded trackers).
  if (master && key === master) return true;
  if (!master) return true;

  // Per-device key issued during provisioning.
  if (key) {
    const { getStore } = await import("@netlify/blobs");
    const keyStore = getStore({ name: "fleet-keys", consistency: "strong" });
    const record = await keyStore.get(`key/${key}`, { type: "json" });
    if (record) return true;
  }
  return false;
}

/** Haversine distance in meters */
function distanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function broadcastPush(title: string, body: string, alertUrl = "/alerts") {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;
  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name: "fleet-workspaces", consistency: "strong" });
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
  const { blobs } = await store.list({ prefix: "push/" });
  await Promise.allSettled(
    blobs.map(async (blob) => {
      const sub = await store.get(blob.key, { type: "json" }) as PushSubscriptionJSON | null;
      if (!sub) return;
      try {
        await webpush.sendNotification(
          sub as Parameters<typeof webpush.sendNotification>[0],
          JSON.stringify({ title, body, url: alertUrl }),
        );
      } catch {
        await store.delete(blob.key);
      }
    }),
  );
}

async function checkAlertsAndGeofences(payload: TelemetryPayload, prevReceivedAt: string | null = null) {
  const lat = payload.gps?.lat != null ? Number(payload.gps.lat) : null;
  const lon = payload.gps?.lon != null ? Number(payload.gps.lon) : null;
  const speed = payload.gps?.speed_kph != null ? Number(payload.gps.speed_kph) : null;
  const deviceId = payload.device_id ?? "";
  const hasFix = Boolean(payload.has_fix) && lat !== null && lon !== null && !isNaN(lat!) && !isNaN(lon!);

  const { getStore } = await import("@netlify/blobs");
  const wsStore = getStore({ name: "fleet-workspaces", consistency: "strong" });

  // Find the workspace that owns this device (cached in device-map/)
  let workspace: WorkspaceState | null = null;
  const cached = await wsStore.get(`device-map/${deviceId}`, { type: "json" }) as WorkspaceState | null;
  if (cached?.vehicles?.some((v) => v.deviceAssignment === deviceId)) {
    workspace = cached;
  } else {
    const { blobs } = await wsStore.list({ prefix: "workspace/" });
    for (const blob of blobs) {
      const ws = await wsStore.get(blob.key, { type: "json" }) as WorkspaceState | null;
      if (ws?.vehicles?.some((v) => v.deviceAssignment === deviceId)) {
        workspace = ws;
        await wsStore.setJSON(`device-map/${deviceId}`, ws);
        break;
      }
    }
  }

  const pushTasks: Promise<void>[] = [];

  const alertStore = getStore({ name: "fleet-telemetry", consistency: "strong" });
  const alertTime = new Date().toISOString();

  async function storeAndPush(type: string, title: string, body: string, url: string, severity: "critical" | "warning" | "info", speedKph: number | null) {
    const alertRecord = {
      id: `alert-${alertTime}-${type}-${deviceId}`,
      device_id: deviceId,
      type,
      title,
      severity,
      time: alertTime,
      speed_kph: speedKph ?? 0,
      lat: lat ?? null,
      lon: lon ?? null,
    };
    await alertStore.setJSON(`device-alerts/${deviceId}/${alertTime}-${type}`, alertRecord);
    return broadcastPush(title, body, url);
  }

  // Per-vehicle alert thresholds
  const vehicle = workspace?.vehicles?.find((v) => v.deviceAssignment === deviceId);
  const thresholds = vehicle?.alertThresholds;

  // Speeding check — uses per-vehicle threshold or global default
  const speedingMph = thresholds?.speedingMph ?? DEFAULT_SPEEDING_MPH;
  if (speed !== null && speedingMph > 0 && speed > speedingMph * 1.60934) {
    const mph = Math.round(speed * 0.621371);
    pushTasks.push(
      storeAndPush("speeding", `Speeding — ${deviceId}`, `Vehicle recorded at ${mph} mph (limit ${speedingMph} mph)`, "/alerts", "critical", speed),
    );
  }

  // Hard brake / rapid accel — firmware sends event_type when it detects these
  const eventType = String((payload as Record<string, unknown>).event_type ?? "");
  if (eventType === "hard_brake" && thresholds?.hardBrakeEnabled !== false) {
    const mph = speed ? Math.round(speed * 0.621371) : 0;
    pushTasks.push(
      storeAndPush("hard_brake", `Hard brake — ${deviceId}`, `Hard braking detected at ${mph} mph`, "/alerts", "warning", speed),
    );
  }
  if (eventType === "rapid_accel" && thresholds?.rapidAccelEnabled !== false) {
    const mph = speed ? Math.round(speed * 0.621371) : 0;
    pushTasks.push(
      storeAndPush("rapid_accel", `Rapid accel — ${deviceId}`, `Rapid acceleration detected at ${mph} mph`, "/alerts", "warning", speed),
    );
  }

  // GPS offline reconnect detection — fires when tracker comes back after being silent > threshold
  const gpsOfflineMinutes = thresholds?.gpsOfflineMinutes ?? 0;
  if (gpsOfflineMinutes > 0 && prevReceivedAt) {
    const gapMs = new Date(alertTime).getTime() - new Date(prevReceivedAt).getTime();
    const gapMin = gapMs / 60000;
    if (gapMin >= gpsOfflineMinutes) {
      const gapRounded = Math.round(gapMin);
      pushTasks.push(
        storeAndPush("gps_offline", `Back online — ${deviceId}`, `Tracker reconnected after ${gapRounded} min offline`, "/alerts", "warning", null),
      );
    }
  }

  // Geofence enter/exit detection
  if (hasFix && workspace?.geofences?.length) {
    const geoStore = getStore({ name: "fleet-telemetry", consistency: "strong" });
    for (const fence of workspace.geofences) {
      if (!fence.alertEnabled) continue;
      const dist = distanceM(lat!, lon!, fence.lat, fence.lon);
      const inside = dist <= fence.radiusM;

      const stateKey = `geofence-state/${deviceId}/${fence.id}`;
      const prev = await geoStore.get(stateKey, { type: "json" }) as { inside: boolean } | null;
      const wasInside = prev?.inside ?? false;

      await geoStore.setJSON(stateKey, { inside, updatedAt: new Date().toISOString() });

      if (inside && !wasInside && (fence.triggerOn === "enter" || fence.triggerOn === "both")) {
        pushTasks.push(storeAndPush("geofence_enter", `Entered: ${fence.name}`, `${deviceId} arrived at ${fence.name}`, "/geofences", "info", speed));
      } else if (!inside && wasInside && (fence.triggerOn === "exit" || fence.triggerOn === "both")) {
        pushTasks.push(storeAndPush("geofence_exit", `Left: ${fence.name}`, `${deviceId} departed ${fence.name}`, "/geofences", "info", speed));
      }
    }
  }

  await Promise.allSettled(pushTasks);
}

async function resolveWifiLocation(
  deviceId: string,
  wifiScan: WifiScanEntry[],
): Promise<{ lat: number; lon: number; source: string } | null> {
  const { getStore } = await import("@netlify/blobs");
  const wsStore = getStore({ name: "fleet-workspaces", consistency: "strong" });

  // Find the owning workspace (device-map cache avoids full scan for known devices)
  let workspace: WorkspaceState | null = null;
  const cached = await wsStore.get(`device-map/${deviceId}`, { type: "json" }) as WorkspaceState | null;
  if (cached?.vehicles?.some((v) => v.deviceAssignment === deviceId)) {
    workspace = cached;
  } else {
    const { blobs } = await wsStore.list({ prefix: "workspace/" });
    for (const blob of blobs) {
      const ws = await wsStore.get(blob.key, { type: "json" }) as WorkspaceState | null;
      if (ws?.vehicles?.some((v) => v.deviceAssignment === deviceId)) {
        workspace = ws;
        await wsStore.setJSON(`device-map/${deviceId}`, ws);
        break;
      }
    }
  }

  // Check depot shortcuts first — no external API needed
  if (workspace?.wifiShortcuts?.length) {
    const scannedSsids = new Set(wifiScan.map((n) => n.ssid).filter(Boolean));
    for (const shortcut of workspace.wifiShortcuts) {
      const names = shortcut.ssids?.length ? shortcut.ssids : (shortcut.ssid ? [shortcut.ssid] : []);
      if (names.some((n) => scannedSsids.has(n))) {
        return { lat: shortcut.lat, lon: shortcut.lon, source: "shortcut" };
      }
    }
  }

  // Fall back to Google Geolocation API (requires GOOGLE_GEOLOCATION_KEY env var)
  const googleKey = process.env.GOOGLE_GEOLOCATION_KEY ?? "";
  if (!googleKey || wifiScan.length === 0) return null;
  try {
    const res = await fetch(
      `https://www.googleapis.com/geolocation/v1/geolocate?key=${googleKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wifiAccessPoints: wifiScan.map((n) => ({
            macAddress: n.bssid,
            signalStrength: n.rssi ?? -80,
          })),
        }),
      },
    );
    if (!res.ok) return null;
    const data = await res.json() as { location?: { lat: number; lng: number } };
    if (data.location) {
      return { lat: data.location.lat, lon: data.location.lng, source: "google" };
    }
  } catch {
    // ignore
  }
  return null;
}

async function saveTelemetry(payload: TelemetryPayload, context: Context) {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name: "fleet-telemetry", consistency: "strong" });
  const deviceId = String(payload.device_id ?? "").trim();
  if (!deviceId) {
    return json({ ok: false, error: "device_id is required" }, 400);
  }

  const receivedAt = new Date().toISOString();
  const record = {
    ...payload,
    device_id: deviceId,
    received_at: receivedAt,
    remote_addr: context.ip ?? null,
  };

  // If no GPS fix but WiFi scan provided, attempt to resolve a location
  let storedRecord = record;
  if (!payload.has_fix && Array.isArray(payload.wifi_scan) && payload.wifi_scan.length > 0) {
    const loc = await resolveWifiLocation(deviceId, payload.wifi_scan);
    if (loc) {
      storedRecord = {
        ...record,
        has_fix: true,
        fix_source: loc.source,
        gps: { lat: loc.lat, lon: loc.lon, speed_kph: 0 },
      };
    }
  }

  // Read previous record before overwriting — needed for GPS offline gap detection + stopped_since tracking
  const prevRecord = await store.get(`latest/${deviceId}`, { type: "json" }) as {
    received_at?: string;
    motion_state?: string;
    stopped_since?: string | null;
  } | null;
  const prevReceivedAt = prevRecord?.received_at ?? null;

  // Track when the vehicle stopped moving so the dashboard can show "Here since X"
  const prevMotion = prevRecord?.motion_state ?? null;
  const currMotion = (storedRecord.motion_state as string | undefined) ?? "stopped";
  let stoppedSince: string | null;
  if (currMotion === "moving") {
    stoppedSince = null;
  } else if (!prevRecord || prevMotion === "moving") {
    stoppedSince = receivedAt; // first packet or just transitioned to stopped
  } else {
    stoppedSince = prevRecord.stopped_since ?? receivedAt;
  }
  const finalRecord = { ...storedRecord, stopped_since: stoppedSince };

  await store.setJSON(`latest/${deviceId}`, finalRecord);
  await store.setJSON(`events/${receivedAt}-${deviceId}`, storedRecord);
  await store.setJSON(`device-events/${deviceId}/${receivedAt}`, storedRecord);

  // Persist last known GPS fix (used for grayed-out "last seen" map marker)
  const gpsLat = (storedRecord as { gps?: { lat?: unknown } }).gps?.lat;
  const gpsLon = (storedRecord as { gps?: { lon?: unknown } }).gps?.lon;
  if (storedRecord.has_fix && gpsLat != null && gpsLon != null) {
    await store.setJSON(`last_gps/${deviceId}`, {
      lat: gpsLat,
      lon: gpsLon,
      time: receivedAt,
      source: storedRecord.fix_source ?? "gps",
    });
  }

  // Non-blocking: run alerts/geofence checks after responding
  checkAlertsAndGeofences(storedRecord, prevReceivedAt).catch(() => {});

  // Check for available OTA update
  const otaStore = getStore({ name: "fleet-ota", consistency: "strong" });
  const latestOta = await otaStore.get("latest", { type: "json" }) as OtaMetadata | null;
  const currentFw = String(payload.firmware ?? "0.0.0");
  const otaAvailable = latestOta && semverGt(latestOta.version, currentFw);

  return json({
    ok: true,
    device_id: deviceId,
    received_at: receivedAt,
    ...(otaAvailable ? { ota: { version: latestOta!.version, size: latestOta!.size } } : {}),
  });
}

export default async (req: Request, context: Context) => {
  if (req.method === "POST") {
    try {
      if (!await isAuthorized(req)) {
        return json({ ok: false, error: "unauthorized" }, 401);
      }
      const payload = (await req.json()) as TelemetryPayload;
      return await saveTelemetry(payload, context);
    } catch {
      return json({ ok: false, error: "invalid json body" }, 400);
    }
  }

  if (req.method === "GET") {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore({ name: "fleet-telemetry", consistency: "strong" });
    const key = new URL(req.url).searchParams.get("device_id");
    if (!key) {
      return json({ ok: true, hint: "POST telemetry or query with ?device_id=tracker-001" });
    }
    const record = await store.get(`latest/${key}`, { type: "json" });
    if (!record) {
      return json({ ok: false, error: "not found" }, 404);
    }
    return json({ ok: true, device: record });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/fleet/telemetry",
  method: ["GET", "POST"],
};
