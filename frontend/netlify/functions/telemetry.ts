import type { Config, Context } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_EMAIL = "mailto:ops@123mobiletrack.com";
const DEFAULT_SPEEDING_MPH = 75;

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

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

type WorkspaceBlob = {
  vehicles?: { id: string; deviceAssignment?: string; alertThresholds?: VehicleAlertThresholds }[];
  geofences?: Geofence[];
  wifiShortcuts?: WifiShortcut[];
};

function semverGt(a: string, b: string): boolean {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return true;
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return false;
  }
  return false;
}

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
  if (master && key === master) return true;
  if (!master) return true;
  return false;
}

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

async function getWorkspaceForDevice(deviceId: string): Promise<{ workspace: WorkspaceBlob | null; orgId: string | null }> {
  const db = supabase();
  // Find the org that owns this device via the vehicles table
  const { data } = await db
    .from("vehicles")
    .select("org_id, organizations(workspace_blob)")
    .eq("device_assignment", deviceId)
    .maybeSingle();

  if (!data) return { workspace: null, orgId: null };
  const org = data.organizations as { workspace_blob?: WorkspaceBlob } | null;
  return {
    workspace: org?.workspace_blob ?? null,
    orgId: data.org_id as string,
  };
}

async function storeAlert(
  deviceId: string,
  orgId: string | null,
  type: string,
  title: string,
  severity: "critical" | "warning" | "info",
  speedKph: number | null,
  lat: number | null,
  lon: number | null,
  alertTime: string,
) {
  const db = supabase();
  await db.from("alerts").insert({
    id: `alert-${alertTime}-${type}-${deviceId}`,
    device_id: deviceId,
    org_id: orgId,
    type,
    title,
    severity,
    time: alertTime,
    speed_kph: speedKph ?? 0,
    lat,
    lon,
  });
}

async function checkAlertsAndGeofences(payload: TelemetryPayload, prevReceivedAt: string | null = null) {
  const lat = payload.gps?.lat != null ? Number(payload.gps.lat) : null;
  const lon = payload.gps?.lon != null ? Number(payload.gps.lon) : null;
  const speed = payload.gps?.speed_kph != null ? Number(payload.gps.speed_kph) : null;
  const deviceId = payload.device_id ?? "";
  const hasFix = Boolean(payload.has_fix) && lat !== null && lon !== null && !isNaN(lat!) && !isNaN(lon!);
  const alertTime = new Date().toISOString();

  const { workspace, orgId } = await getWorkspaceForDevice(deviceId);

  const vehicle = workspace?.vehicles?.find((v) => v.deviceAssignment === deviceId);
  const thresholds = vehicle?.alertThresholds;

  const pushTasks: Promise<void>[] = [];

  async function alert(type: string, title: string, body: string, url: string, severity: "critical" | "warning" | "info", speedVal: number | null) {
    await storeAlert(deviceId, orgId, type, title, severity, speedVal, lat, lon, alertTime);
    pushTasks.push(broadcastPush(title, body, url));
  }

  const speedingMph = thresholds?.speedingMph ?? DEFAULT_SPEEDING_MPH;
  if (speed !== null && speedingMph > 0 && speed > speedingMph * 1.60934) {
    const mph = Math.round(speed * 0.621371);
    await alert("speeding", `Speeding — ${deviceId}`, `Vehicle recorded at ${mph} mph (limit ${speedingMph} mph)`, "/alerts", "critical", speed);
  }

  const eventType = String((payload as Record<string, unknown>).event_type ?? "");
  if (eventType === "hard_brake" && thresholds?.hardBrakeEnabled !== false) {
    const mph = speed ? Math.round(speed * 0.621371) : 0;
    await alert("hard_brake", `Hard brake — ${deviceId}`, `Hard braking detected at ${mph} mph`, "/alerts", "warning", speed);
  }
  if (eventType === "rapid_accel" && thresholds?.rapidAccelEnabled !== false) {
    const mph = speed ? Math.round(speed * 0.621371) : 0;
    await alert("rapid_accel", `Rapid accel — ${deviceId}`, `Rapid acceleration detected at ${mph} mph`, "/alerts", "warning", speed);
  }

  const gpsOfflineMinutes = thresholds?.gpsOfflineMinutes ?? 0;
  if (gpsOfflineMinutes > 0 && prevReceivedAt) {
    const gapMin = (new Date(alertTime).getTime() - new Date(prevReceivedAt).getTime()) / 60000;
    if (gapMin >= gpsOfflineMinutes) {
      await alert("gps_offline", `Back online — ${deviceId}`, `Tracker reconnected after ${Math.round(gapMin)} min offline`, "/alerts", "warning", null);
    }
  }

  // Geofence detection — state stored in Netlify Blobs (small, transient)
  if (hasFix && workspace?.geofences?.length) {
    const { getStore } = await import("@netlify/blobs");
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
        await alert("geofence_enter", `Entered: ${fence.name}`, `${deviceId} arrived at ${fence.name}`, "/geofences", "info", speed);
      } else if (!inside && wasInside && (fence.triggerOn === "exit" || fence.triggerOn === "both")) {
        await alert("geofence_exit", `Left: ${fence.name}`, `${deviceId} departed ${fence.name}`, "/geofences", "info", speed);
      }
    }
  }

  await Promise.allSettled(pushTasks);
}

async function resolveWifiLocation(deviceId: string, wifiScan: WifiScanEntry[]): Promise<{ lat: number; lon: number; source: string } | null> {
  const { workspace } = await getWorkspaceForDevice(deviceId);

  if (workspace?.wifiShortcuts?.length) {
    const scannedSsids = new Set(wifiScan.map((n) => n.ssid).filter(Boolean));
    for (const shortcut of workspace.wifiShortcuts) {
      const names = shortcut.ssids?.length ? shortcut.ssids : (shortcut.ssid ? [shortcut.ssid] : []);
      if (names.some((n) => scannedSsids.has(n))) {
        return { lat: shortcut.lat, lon: shortcut.lon, source: "shortcut" };
      }
    }
  }

  const googleKey = process.env.GOOGLE_GEOLOCATION_KEY ?? "";
  if (!googleKey || wifiScan.length === 0) return null;
  try {
    const res = await fetch(`https://www.googleapis.com/geolocation/v1/geolocate?key=${googleKey}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wifiAccessPoints: wifiScan.map((n) => ({ macAddress: n.bssid, signalStrength: n.rssi ?? -80 })) }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { location?: { lat: number; lng: number } };
    if (data.location) return { lat: data.location.lat, lon: data.location.lng, source: "google" };
  } catch { /* ignore */ }
  return null;
}

async function saveTelemetry(payload: TelemetryPayload, context: Context) {
  const db = supabase();
  const deviceId = String(payload.device_id ?? "").trim();
  if (!deviceId) return json({ ok: false, error: "device_id is required" }, 400);

  const receivedAt = new Date().toISOString();

  let storedPayload = { ...payload, device_id: deviceId, received_at: receivedAt, remote_addr: context.ip ?? null };

  if (!payload.has_fix && Array.isArray(payload.wifi_scan) && payload.wifi_scan.length > 0) {
    const loc = await resolveWifiLocation(deviceId, payload.wifi_scan);
    if (loc) {
      storedPayload = { ...storedPayload, has_fix: true, fix_source: loc.source, gps: { lat: loc.lat, lon: loc.lon, speed_kph: 0 } };
    }
  }

  // Fetch previous record for gap detection + stopped_since tracking
  const { data: prevRow } = await db
    .from("telemetry_latest")
    .select("received_at, motion_state, stopped_since")
    .eq("device_id", deviceId)
    .maybeSingle();

  const prevReceivedAt = prevRow?.received_at ?? null;
  const prevMotion = prevRow?.motion_state ?? null;
  const currMotion = (storedPayload.motion_state as string | undefined) ?? "stopped";

  let stoppedSince: string | null;
  if (currMotion === "moving") {
    stoppedSince = null;
  } else if (!prevRow || prevMotion === "moving") {
    stoppedSince = receivedAt;
  } else {
    stoppedSince = (prevRow.stopped_since as string | null) ?? receivedAt;
  }

  const gps = storedPayload.gps as GpsPayload | undefined;
  const lat = gps?.lat != null ? Number(gps.lat) : null;
  const lon = gps?.lon != null ? Number(gps.lon) : null;
  const speedKph = gps?.speed_kph != null ? Number(gps.speed_kph) : null;
  const lastGps = (storedPayload as Record<string, unknown>).last_gps as { lat?: unknown; lon?: unknown } | undefined;

  // Find org_id for this device
  const { orgId } = await getWorkspaceForDevice(deviceId);

  await db.from("telemetry_latest").upsert({
    device_id: deviceId,
    org_id: orgId,
    has_fix: storedPayload.has_fix ?? false,
    fix_source: storedPayload.fix_source ?? null,
    battery_mv: storedPayload.battery_mv ?? null,
    cell_rssi: storedPayload.cell_rssi ?? null,
    firmware: storedPayload.firmware ?? null,
    lat: storedPayload.has_fix ? lat : null,
    lon: storedPayload.has_fix ? lon : null,
    speed_kph: speedKph,
    gps_timestamp: gps?.timestamp ?? null,
    last_lat: lastGps?.lat != null ? Number(lastGps.lat) : null,
    last_lon: lastGps?.lon != null ? Number(lastGps.lon) : null,
    motion_state: currMotion,
    queued_messages: (storedPayload.queued_messages as number | undefined) ?? null,
    stopped_since: stoppedSince,
    received_at: receivedAt,
    raw: storedPayload,
  }, { onConflict: "device_id" });

  checkAlertsAndGeofences(storedPayload, prevReceivedAt).catch(() => {});

  // OTA check — still in Netlify Blobs
  let otaAvailable = false;
  let latestOta: OtaMetadata | null = null;
  try {
    const { getStore } = await import("@netlify/blobs");
    const otaStore = getStore({ name: "fleet-ota", consistency: "strong" });
    latestOta = await otaStore.get("latest", { type: "json" }) as OtaMetadata | null;
    const currentFw = String(payload.firmware ?? "0.0.0");
    otaAvailable = !!(latestOta && semverGt(latestOta.version, currentFw));
  } catch { /* ignore */ }

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
      if (!await isAuthorized(req)) return json({ ok: false, error: "unauthorized" }, 401);
      const payload = (await req.json()) as TelemetryPayload;
      return await saveTelemetry(payload, context);
    } catch {
      return json({ ok: false, error: "invalid json body" }, 400);
    }
  }

  if (req.method === "GET") {
    const deviceId = new URL(req.url).searchParams.get("device_id");
    if (!deviceId) return json({ ok: true, hint: "POST telemetry or query with ?device_id=tracker-001" });
    const db = supabase();
    const { data } = await db.from("telemetry_latest").select("*").eq("device_id", deviceId).maybeSingle();
    if (!data) return json({ ok: false, error: "not found" }, 404);
    return json({ ok: true, device: data });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/fleet/telemetry",
  method: ["GET", "POST"],
};
