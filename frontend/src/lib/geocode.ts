"use client";

import { useEffect, useState } from "react";

const US_STATE_ABBR: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR",
  California: "CA", Colorado: "CO", Connecticut: "CT", Delaware: "DE",
  Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID",
  Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS",
  Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
  Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS",
  Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV",
  "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
  "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK",
  Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT",
  Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV",
  Wisconsin: "WI", Wyoming: "WY",
};

const geocodeCache = new Map<string, string>();
const pendingListeners = new Map<string, Set<(v: string) => void>>();
const taskQueue: Array<() => Promise<void>> = [];
let queueRunning = false;

async function runQueue() {
  if (queueRunning) return;
  queueRunning = true;
  while (taskQueue.length > 0) {
    const task = taskQueue.shift()!;
    await task();
    await new Promise<void>((r) => setTimeout(r, 1200));
  }
  queueRunning = false;
}

function cacheKey(lat: number, lon: number) {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

function enqueue(lat: number, lon: number, key: string) {
  taskQueue.push(async () => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
        { headers: { "User-Agent": "123MobileTrack/1.0 fleet@123mobiletrack.com" } },
      );
      const data = (await res.json()) as { address?: Record<string, string> };
      const addr = data.address ?? {};
      const city = addr.city ?? addr.town ?? addr.village ?? addr.hamlet ?? addr.county ?? "";
      const stateAbbr = US_STATE_ABBR[addr.state ?? ""] ?? "";
      const label = city && stateAbbr ? `${city}, ${stateAbbr}` : city || key;
      geocodeCache.set(key, label);
      pendingListeners.get(key)?.forEach((cb) => cb(label));
    } catch {
      const fallback = `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
      geocodeCache.set(key, fallback);
      pendingListeners.get(key)?.forEach((cb) => cb(fallback));
    } finally {
      pendingListeners.delete(key);
    }
  });
  runQueue();
}

function subscribe(lat: number, lon: number, cb: (v: string) => void): () => void {
  const key = cacheKey(lat, lon);
  if (geocodeCache.has(key)) {
    cb(geocodeCache.get(key)!);
    return () => {};
  }
  if (!pendingListeners.has(key)) {
    pendingListeners.set(key, new Set());
    enqueue(lat, lon, key);
  }
  const set = pendingListeners.get(key)!;
  set.add(cb);
  return () => set.delete(cb);
}

export function useGeocode(lat: number | undefined, lon: number | undefined): string {
  const [label, setLabel] = useState("…");
  useEffect(() => {
    if (lat == null || lon == null) return;
    const key = cacheKey(lat, lon);
    if (geocodeCache.has(key)) {
      setLabel(geocodeCache.get(key)!);
      return;
    }
    setLabel("…");
    return subscribe(lat, lon, setLabel);
  }, [lat, lon]);
  return label;
}
