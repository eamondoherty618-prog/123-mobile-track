"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export type LiveTrackerPacket = {
  device_id: string;
  has_fix?: boolean;
  fix_source?: string;
  battery_mv?: number;
  cell_rssi?: number;
  firmware?: string;
  gps?: {
    lat?: number | string;
    lon?: number | string;
    speed_kph?: number | string;
    timestamp?: string;
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
  return {
    device_id: row.device_id as string,
    has_fix: row.has_fix as boolean | undefined,
    fix_source: row.fix_source as string | undefined,
    battery_mv: row.battery_mv as number | undefined,
    cell_rssi: row.cell_rssi as number | undefined,
    firmware: row.firmware as string | undefined,
    motion_state: row.motion_state as string | undefined,
    queued_messages: row.queued_messages as number | undefined,
    received_at: row.received_at as string | undefined,
    stopped_since: row.stopped_since as string | null | undefined,
    gps: row.lat != null ? {
      lat: row.lat as number,
      lon: row.lon as number,
      speed_kph: row.speed_kph as number | undefined,
      timestamp: row.gps_timestamp as string | undefined,
    } : undefined,
    last_gps: row.last_lat != null ? {
      lat: row.last_lat as number,
      lon: row.last_lon as number,
    } : undefined,
  };
}

export function useAllTrackers() {
  const [trackers, setTrackers] = useState<LiveTrackerPacket[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (document.hidden) return;
      try {
        const { data } = await supabase.from("telemetry_latest").select("*");
        if (!cancelled && data) setTrackers(data.map(rowToPacket));
      } catch {
        // non-fatal
      }
    }

    function onVisible() {
      if (!document.hidden) load();
    }

    load();
    const intervalId = window.setInterval(load, 60000);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return trackers;
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
