"use client";

import { useEffect, useMemo, useState } from "react";

import { Device } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";
export const LIVE_TRACKER_ENDPOINT = `${API_BASE}/api/fleet/telemetry?device_id=tracker-001`;

export type LiveTrackerPacket = {
  device_id: string;
  has_fix?: boolean;
  battery_mv?: number;
  cell_rssi?: number;
  firmware?: string;
  gps?: {
    lat?: number | string;
    lon?: number | string;
    speed_kph?: number | string;
    timestamp?: string;
  };
  motion_state?: string;
  queued_messages?: number;
  received_at?: string;
};

export function useAllTrackers() {
  const [trackers, setTrackers] = useState<LiveTrackerPacket[]>([]);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/fleet/telemetry`, { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { ok: boolean; devices?: Record<string, LiveTrackerPacket> };
        if (!cancelled && body.devices) setTrackers(Object.values(body.devices));
      } catch {
        // non-fatal
      }
    }
    load();
    const id = window.setInterval(load, 15000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, []);
  return trackers;
}

export type LiveTracker = {
  battery_mv?: number;
  cell_rssi?: number;
  device_id?: string;
  firmware?: string;
  gps?: {
    lat?: number | string;
    lon?: number | string;
    speed_kph?: number | string;
    timestamp?: string;
  };
  has_fix?: boolean;
  motion_state?: string;
  queued_messages?: number;
  received_at?: string;
};

export function useLiveTracker() {
  const [liveTracker, setLiveTracker] = useState<LiveTracker | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLiveTracker() {
      try {
        const response = await fetch(LIVE_TRACKER_ENDPOINT, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const body = (await response.json()) as { ok: boolean; device?: LiveTracker };
        if (!cancelled) {
          setLiveTracker(body.device ?? null);
          setLiveError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setLiveError(error instanceof Error ? error.message : "Unable to load live tracker");
        }
      }
    }

    loadLiveTracker();
    const interval = window.setInterval(loadLiveTracker, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return { liveTracker, liveError };
}

export function buildPrototypeDevice(liveTracker: LiveTracker | null): Device {
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
  liveTracker: LiveTracker | null,
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
