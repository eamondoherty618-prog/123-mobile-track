import type { Config, Context } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import ws from "ws";

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_EMAIL = "mailto:ops@123mobiletrack.com";
const DEFAULT_SPEEDING_MPH = 75;
const MIN_TRIP_DURATION_S = 60;
const MIN_MOVING_KPH = 4;

type TripPoint = { lat: number; lon: number; speed_kph: number; time: string; event?: string | null };
type TripBuffer = { device_id: string; start_time: string; points: TripPoint[]; paused_at?: string };
type TripEventRecord = { type: string; time: string; lat: number; lon: number; speed_kph: number };

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { realtime: { transport: ws } },
  );
}

type GpsPayload = {
  lat?: number | string;
  lon?: number | string;
  speed_kph?: number | string;
  timestamp?: string;
};

type WifiScanEntry = { ssid?: string; bssid: string; rssi?: number };
type CellInfoPayload = { radio?: string; mcc?: number; mnc?: number; lac?: number; cid?: number };

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
  cell_info?: CellInfoPayload;
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

async function finalizeTripFromBuffer(
  store: Awaited<ReturnType<typeof import("@netlify/blobs").getStore>>,
  db: ReturnType<typeof supabase>,
  deviceId: string,
  orgId: string | null,
): Promise<void> {
  const key = `trip-buffer/${deviceId}`;
  const buf = await store.get(key, { type: "json" }) as TripBuffer | null;
  if (!buf || buf.points.length < 2) { if (buf) await store.delete(key); return; }

  const pts = buf.points
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
    .filter((p) => p.lat && p.lon && !isNaN(p.lat) && !isNaN(p.lon));

  if (pts.length < 2) { await store.delete(key); return; }

  const durS = (new Date(pts[pts.length - 1].time).getTime() - new Date(pts[0].time).getTime()) / 1000;
  if (durS < MIN_TRIP_DURATION_S) { await store.delete(key); return; }

  let distM = 0, maxSpeed = 0, speedSum = 0;
  const events: TripEventRecord[] = [];

  for (let i = 1; i < pts.length; i++) {
    distM += distanceM(pts[i - 1].lat, pts[i - 1].lon, pts[i].lat, pts[i].lon);
    if (pts[i].speed_kph > maxSpeed) maxSpeed = pts[i].speed_kph;
    speedSum += pts[i].speed_kph;
    if (pts[i].event) {
      events.push({ type: pts[i].event!, time: pts[i].time, lat: pts[i].lat, lon: pts[i].lon, speed_kph: pts[i].speed_kph });
    }
  }

  await db.from("trips").upsert({
    id: `trip-${pts[0].time}-${deviceId}`,
    device_id: deviceId,
    org_id: orgId,
    start_time: pts[0].time,
    end_time: pts[pts.length - 1].time,
    duration_s: Math.round(durS),
    distance_km: Math.round((distM / 1000) * 100) / 100,
    max_speed_kph: Math.round(maxSpeed),
    avg_speed_kph: Math.round(speedSum / (pts.length - 1)),
    point_count: pts.length,
    event_count: events.length,
    events,
    start_lat: pts[0].lat,
    start_lon: pts[0].lon,
    end_lat: pts[pts.length - 1].lat,
    end_lon: pts[pts.length - 1].lon,
    route: pts.map((p) => ({ lat: p.lat, lon: p.lon, speed_kph: p.speed_kph, time: p.time, motion_state: "moving" })),
  }, { onConflict: "id" });

  await store.delete(key);
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
  const { getStore } = await import("@netlify/blobs");

  // Primary: look up device→user reverse index written by provision.ts at claim time.
  const provStore = getStore({ name: "fleet-provision", consistency: "strong" });
  const lookup = await provStore.get(`device-to-user/${deviceId}`, { type: "json" }) as {
    userId: string; email: string;
  } | null;

  if (lookup) {
    const wsStore = getStore({ name: "fleet-workspaces", consistency: "strong" });
    let wsKey = `workspace/${lookup.userId}`;
    if (lookup.email) {
      const membership = await wsStore.get(`member/${lookup.email}`, { type: "json" }) as { orgOwner: string } | null;
      if (membership?.orgOwner) wsKey = `workspace/${membership.orgOwner}`;
    }
    const workspace = await wsStore.get(wsKey, { type: "json" }) as WorkspaceBlob | null;
    if (workspace) return { workspace, orgId: lookup.userId };
  }

  // Fallback: scan all workspace blobs for a vehicle with this deviceAssignment.
  // Slower but handles cases where the reverse index wasn't written yet.
  const wsStore = getStore({ name: "fleet-workspaces", consistency: "strong" });
  const { blobs } = await wsStore.list({ prefix: "workspace/" });
  for (const blob of blobs) {
    const ws = await wsStore.get(blob.key, { type: "json" }) as WorkspaceBlob | null;
    if (ws?.vehicles?.find((v) => v.deviceAssignment === deviceId)) {
      const orgId = blob.key.replace("workspace/", "");
      return { workspace: ws, orgId };
    }
  }

  return { workspace: null, orgId: null };
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

// Priority order: WiFi shortcuts (exact) → Google (if key) → Mozilla Location Services (free).
// Accepts optional cell tower info to include in MLS / Google requests for better accuracy.
async function resolveGeolocation(
  deviceId: string,
  wifiScan: WifiScanEntry[],
  cellInfo?: CellInfoPayload | null,
): Promise<{ lat: number; lon: number; accuracy?: number; source: string } | null> {
  // 1. WiFi shortcuts — user-defined home/office anchors, instant and exact.
  // Check the assigned org first; if the device is unassigned, scan ALL orgs so that
  // a freshly-flashed or unprovisioned tracker still resolves its location when it's
  // at a known WiFi (e.g. home, office) even before it's linked to a vehicle.
  if (wifiScan.length > 0) {
    const scannedSsids = new Set(wifiScan.map((n) => n.ssid).filter(Boolean));

    const matchShortcuts = (shortcuts: WifiShortcut[] | undefined) => {
      if (!shortcuts?.length) return null;
      for (const shortcut of shortcuts) {
        const names = shortcut.ssids?.length ? shortcut.ssids : (shortcut.ssid ? [shortcut.ssid] : []);
        if (names.some((n) => scannedSsids.has(n))) {
          return { lat: shortcut.lat, lon: shortcut.lon, source: "shortcut" as const };
        }
      }
      return null;
    };

    const { workspace } = await getWorkspaceForDevice(deviceId);
    const hit = matchShortcuts(workspace?.wifiShortcuts);
    if (hit) return hit;

    // Device not in any vehicle assignment — try all orgs' shortcuts so unassigned
    // trackers still get location when they're at a known WiFi network.
    if (!workspace) {
      const db = supabase();
      const { data: orgs } = await db.from("organizations").select("workspace_blob");
      if (orgs) {
        for (const org of orgs) {
          const blob = org.workspace_blob as WorkspaceBlob | null;
          const orgHit = matchShortcuts(blob?.wifiShortcuts);
          if (orgHit) return orgHit;
        }
      }
    }
  }

  const mlsWifi = wifiScan.map((n) => ({ macAddress: n.bssid, signalStrength: n.rssi ?? -80 }));
  const mlsCell = (cellInfo?.mcc && cellInfo?.cid) ? [{
    radioType: cellInfo.radio ?? "lte",
    mobileCountryCode: cellInfo.mcc,
    mobileNetworkCode: cellInfo.mnc ?? 0,
    locationAreaCode: cellInfo.lac ?? 0,
    cellId: cellInfo.cid,
  }] : undefined;

  if (mlsWifi.length === 0 && !mlsCell) return null;

  // 2. Google Geolocation API (highest accuracy, requires API key).
  const googleKey = process.env.GOOGLE_GEOLOCATION_KEY ?? "";
  if (googleKey && mlsWifi.length > 0) {
    try {
      const body: Record<string, unknown> = { wifiAccessPoints: mlsWifi };
      if (mlsCell) body.cellTowers = mlsCell;
      const res = await fetch(`https://www.googleapis.com/geolocation/v1/geolocate?key=${googleKey}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json() as { location?: { lat: number; lng: number }; accuracy?: number };
        if (data.location) return { lat: data.location.lat, lon: data.location.lng, accuracy: data.accuracy, source: "google" };
      }
    } catch { /* fall through to MLS */ }
  }

  // 3. Mozilla Location Services — free, no key required, works with WiFi + cell.
  try {
    const mlsBody: Record<string, unknown> = {};
    if (mlsWifi.length > 0) mlsBody.wifiAccessPoints = mlsWifi;
    if (mlsCell) mlsBody.cellTowers = mlsCell;
    const res = await fetch("https://location.services.mozilla.com/v1/geolocate?key=test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(mlsBody),
    });
    if (res.ok) {
      const data = await res.json() as { location?: { lat: number; lng: number }; accuracy?: number };
      if (data.location) {
        const src = mlsWifi.length > 0 ? "wifi" : "cell";
        return { lat: data.location.lat, lon: data.location.lng, accuracy: data.accuracy, source: src };
      }
    }
  } catch { /* ignore */ }

  return null;
}

async function saveTelemetry(payload: TelemetryPayload, context: Context) {
  const db = supabase();
  const deviceId = String(payload.device_id ?? "").trim();
  if (!deviceId) return json({ ok: false, error: "device_id is required" }, 400);

  const receivedAt = new Date().toISOString();

  let storedPayload = { ...payload, device_id: deviceId, received_at: receivedAt, remote_addr: context.ip ?? null };

  const trackerHasFix = Boolean(payload.has_fix) && payload.fix_source !== "GPS_MARGINAL";
  let geoLoc: { lat: number; lon: number; accuracy?: number; source: string } | null = null;
  if (!trackerHasFix) {
    const wifiScan = Array.isArray(payload.wifi_scan) ? payload.wifi_scan : [];
    const cellInfo = (payload.cell_info as CellInfoPayload | undefined) ?? null;
    if (wifiScan.length > 0 || cellInfo?.mcc) {
      geoLoc = await resolveGeolocation(deviceId, wifiScan, cellInfo);
      if (geoLoc) {
        storedPayload = { ...storedPayload, has_fix: true, fix_source: geoLoc.source, gps: { lat: geoLoc.lat, lon: geoLoc.lon, speed_kph: 0 } };
      }
    }
  }

  // Fetch previous record for gap detection + stopped_since tracking
  const { data: prevRow } = await db
    .from("telemetry_latest")
    .select("received_at, motion_state, stopped_since, last_lat, last_lon, lat, lon, gps_timestamp")
    .eq("device_id", deviceId)
    .maybeSingle();

  const prevReceivedAt = prevRow?.received_at ?? null;
  const prevMotion = prevRow?.motion_state ?? null;
  const currMotion = (storedPayload.motion_state as string | undefined) ?? "stopped";

  const gpsTimestamp = (storedPayload.gps as GpsPayload | undefined)?.timestamp ?? null;
  let stoppedSince: string | null;
  if (currMotion === "moving") {
    stoppedSince = null;
  } else if (!prevRow || prevMotion === "moving") {
    stoppedSince = gpsTimestamp ?? receivedAt;
  } else {
    stoppedSince = (prevRow.stopped_since as string | null) ?? gpsTimestamp ?? receivedAt;
  }

  const gps = storedPayload.gps as GpsPayload | undefined;
  const lat = gps?.lat != null ? Number(gps.lat) : null;
  const lon = gps?.lon != null ? Number(gps.lon) : null;
  const speedKph = gps?.speed_kph != null ? Number(gps.speed_kph) : null;
  const lastGps = (storedPayload as Record<string, unknown>).last_gps as { lat?: unknown; lon?: unknown; time?: unknown } | undefined;
  const deadReckoning = (storedPayload as Record<string, unknown>).dead_reckoning as { lat?: unknown; lon?: unknown } | undefined;

  // Preserve last known coordinates:
  // Priority: firmware last_gps → current quality fix → dead reckoning → previous DB value.
  const newLastLat = lastGps?.lat != null ? Number(lastGps.lat)
    : storedPayload.has_fix ? lat
    : deadReckoning?.lat != null ? Number(deadReckoning.lat)
    : (prevRow?.last_lat as number | null) ?? (prevRow?.lat as number | null) ?? null;
  const newLastLon = lastGps?.lon != null ? Number(lastGps.lon)
    : storedPayload.has_fix ? lon
    : deadReckoning?.lon != null ? Number(deadReckoning.lon)
    : (prevRow?.last_lon as number | null) ?? (prevRow?.lon as number | null) ?? null;
  // Upsert telemetry first — must succeed regardless of workspace lookup.
  await db.from("telemetry_latest").upsert({
    device_id: deviceId,
    org_id: null,
    has_fix: storedPayload.has_fix ?? false,
    fix_source: storedPayload.fix_source ?? null,
    battery_mv: storedPayload.battery_mv ?? null,
    cell_rssi: storedPayload.cell_rssi ?? null,
    firmware: storedPayload.firmware ?? null,
    lat: storedPayload.has_fix ? lat : null,
    lon: storedPayload.has_fix ? lon : null,
    speed_kph: speedKph,
    gps_timestamp: storedPayload.has_fix ? (gps?.timestamp ?? null) : ((prevRow as Record<string, unknown>)?.gps_timestamp as string | null) ?? null,
    last_lat: newLastLat,
    last_lon: newLastLon,
    motion_state: currMotion,
    queued_messages: (storedPayload.queued_messages as number | undefined) ?? null,
    stopped_since: stoppedSince,
    received_at: receivedAt,
    raw: storedPayload,
  }, { onConflict: "device_id" });

  // Resolve org after upsert — alerts/trips are best-effort.
  const { orgId } = await getWorkspaceForDevice(deviceId).catch(() => ({ orgId: null }));

  checkAlertsAndGeofences(storedPayload, prevReceivedAt).catch(() => {});

  // Write latest packet to Netlify Blobs so latest.ts (Devices page) stays current.
  const blobWrite = async () => {
    const { getStore } = await import("@netlify/blobs");
    const latestStore = getStore({ name: "fleet-telemetry", consistency: "strong" });
    const latestRecord = { ...storedPayload, received_at: receivedAt, stopped_since: stoppedSince };
    await latestStore.setJSON(`latest/${deviceId}`, latestRecord);
    if (newLastLat !== null && newLastLon !== null) {
      await latestStore.setJSON(`last_gps/${deviceId}`, {
        lat: newLastLat, lon: newLastLon,
        time: receivedAt,
        source: storedPayload.fix_source ?? (storedPayload.has_fix ? "gps" : "last"),
      });
    }
  };
  blobWrite().catch(() => {});

  // Trip recording — buffer GPS points while moving, finalize when motion stops
  if (lat !== null && lon !== null && storedPayload.has_fix) {
    const tripRecording = async () => {
      const { getStore } = await import("@netlify/blobs");
      const tripStore = getStore({ name: "fleet-telemetry", consistency: "strong" });
      const bufKey = `trip-buffer/${deviceId}`;

      const TRIP_PAUSE_MS = 5 * 60 * 1000; // wait 5 min stopped before finalizing

      if (currMotion === "moving" && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        const existing = await tripStore.get(bufKey, { type: "json" }) as TripBuffer | null;
        const buf: TripBuffer = existing ?? { device_id: deviceId, start_time: gps?.timestamp ?? receivedAt, points: [] };
        delete buf.paused_at; // resumed moving — cancel any pending finalization
        buf.points.push({
          lat,
          lon,
          speed_kph: speedKph ?? 0,
          time: gps?.timestamp ?? receivedAt,
          event: ((storedPayload as Record<string, unknown>).event as string | undefined) ?? null,
        });
        if (buf.points.length > 1000) buf.points = buf.points.slice(-1000);
        await tripStore.setJSON(bufKey, buf);
      } else if (currMotion !== "moving") {
        // Stopped — start a pause timer; only finalize after TRIP_PAUSE_MS of continuous stopping
        const existing = await tripStore.get(bufKey, { type: "json" }) as TripBuffer | null;
        if (existing && existing.points.length > 0) {
          if (!existing.paused_at) {
            existing.paused_at = receivedAt;
            await tripStore.setJSON(bufKey, existing);
          } else if (Date.now() - new Date(existing.paused_at).getTime() >= TRIP_PAUSE_MS) {
            const db2 = supabase();
            await finalizeTripFromBuffer(tripStore, db2, deviceId, orgId);
          }
        }
      }
    };
    tripRecording().catch(() => {});
  }

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
    // Send geolocation result back so tracker can inject it as last known position.
    ...(!trackerHasFix && geoLoc ? { wifi_location: { lat: geoLoc.lat, lon: geoLoc.lon } } : {}),
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
