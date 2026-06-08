"use client";

import { useEffect, useRef, useMemo, useState } from "react";

export type LiveTrackerPacket = {
  device_id: string;
  has_fix?: boolean;
  fix_source?: string;
  battery_mv?: number;
  ignition_on?: boolean;
  cell_rssi?: number;
  firmware?: string;
  gps?: {
    lat?: number | string;
    lon?: number | string;
    speed_kph?: number | string;
    timestamp?: string;
    course_deg?: number;
  };
  last_gps?: {
    lat: number | string;
    lon: number | string;
    time?: string;
    source?: string;
  };
  motion_state?: string;
  queued_messages?: number;
  received_at?: string;
  stopped_since?: string | null;
};

function rowToPacket(row: Record<string, unknown>): LiveTrackerPacket {
  const battMv = row.battery_mv as number | undefined;
  const gps = row.gps as { lat?: unknown; lon?: unknown; speed_kph?: unknown; timestamp?: string } | undefined;
  const lastGps = row.last_gps as { lat?: unknown; lon?: unknown; time?: string; source?: string } | undefined;
  return {
    device_id: row.device_id as string,
    has_fix: row.has_fix as boolean | undefined,
    fix_source: row.fix_source as string | undefined,
    battery_mv: battMv,
    ignition_on: battMv != null && battMv > 13200,
    cell_rssi: row.cell_rssi as number | undefined,
    firmware: row.firmware as string | undefined,
    motion_state: row.motion_state as string | undefined,
    queued_messages: row.queued_messages as number | undefined,
    received_at: row.received_at as string | undefined,
    stopped_since: row.stopped_since as string | null | undefined,
    gps: gps?.lat != null ? {
      lat: gps.lat as number,
      lon: gps.lon as number,
      speed_kph: gps.speed_kph as number | undefined,
      timestamp: gps.timestamp,
      course_deg: gps.course_deg as number | undefined,
    } : undefined,
    last_gps: lastGps?.lat != null ? {
      lat: lastGps.lat as number,
      lon: lastGps.lon as number,
      time: lastGps.time,
      source: lastGps.source,
    } : undefined,
  };
}

async function fetchTrackers(token: string): Promise<LiveTrackerPacket[]> {
  const res = await fetch("/api/fleet/latest", {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json() as { devices?: Record<string, Record<string, unknown>> };
  return Object.entries(data.devices ?? {}).map(([, rec]) => rowToPacket(rec));
}

export function useAllTrackers(token?: string) {
  const [trackers, setTrackers] = useState<LiveTrackerPacket[]>([]);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    const load = async () => {
      const packets = await fetchTrackers(token);
      if (!cancelled && packets.length > 0) setTrackers(packets);
    };

    load();
    const interval = window.setInterval(() => {
      if (tokenRef.current) fetchTrackers(tokenRef.current).then((p) => {
        if (!cancelled && p.length > 0) setTrackers(p);
      });
    }, 5_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [token]);

  return trackers;
}

export function latestRecordToPacket(deviceId: string, rec: Record<string, unknown>): LiveTrackerPacket {
  return rowToPacket({ ...rec, device_id: deviceId });
}

export function buildPrototypeDevice(liveTracker: LiveTrackerPacket | null) {
  const signalStrength = Math.max(
    0,
    Math.min(100, Math.round(((liveTracker?.cell_rssi ?? 0) / 31) * 100)),
  );
  const batteryLevel = Math.max(
    0,
    Math.min(100, Math.round((((liveTracker?.battery_mv ?? 3600) - 3300) / 900) * 100)),
  );

  return {
    id: liveTracker?.device_id ?? "tracker-001",
    assignedVehicleId: "",
    simNumber: "1NCE SIM installed",
    firmwareVersion: liveTracker?.firmware ?? "0.1.0",
    batteryLevel,
    signalStrength,
    gpsLock: Boolean(liveTracker?.has_fix),
    sleepState: "awake",
    motionState: liveTracker?.motion_state === "moving" ? "moving" : "stopped",
    movingUpdateInterval: "10 seconds",
    stoppedUpdateInterval: "60 seconds",
    idleTimeout: "5 minutes",
    deepSleepTimeout: "15 minutes",
    heartbeatInterval: "30 minutes",
    reportingProfile: "smart-sleep",
    lastPing: liveTracker?.received_at ?? "No updates yet",
    online: Boolean(liveTracker?.received_at),
    enabledFeatures: [
      "GPS Tracking",
      "Live Location",
      "Motion Wake",
      "Smart Sleep Mode",
      "Battery Monitoring",
    ],
  };
}

export function useSetupChecklist(
  liveTracker: LiveTrackerPacket | null,
  liveError: string | null,
  vehicleCount: number,
  trackerAssigned: boolean,
) {
  return useMemo(
    () => [
      {
        title: "Tracker online",
        done: Boolean(liveTracker?.received_at && !liveError),
        detail: liveTracker?.received_at
          ? `Last packet ${new Date(liveTracker.received_at).toLocaleString()}`
          : "Waiting for the first successful update to arrive.",
      },
      {
        title: "Vehicle profile created",
        done: vehicleCount > 0 && trackerAssigned,
        detail:
          vehicleCount > 0
            ? trackerAssigned
              ? "A tracker is linked to a vehicle record."
              : "A vehicle record exists. Go to Devices to assign a tracker."
            : "Create the first vehicle record and assign a tracker to it.",
      },
      {
        title: "GPS lock confirmed outdoors",
        done: Boolean(liveTracker?.has_fix),
        detail: liveTracker?.has_fix
          ? "Coordinates are available from the live feed."
          : "Move the device near a window or into the vehicle to acquire GNSS.",
      },
      {
        title: "Alerts and geofences configured",
        done: false,
        detail: "Turn on operational rules after the first vehicle is assigned.",
      },
    ],
    [liveError, liveTracker, trackerAssigned, vehicleCount],
  );
}
