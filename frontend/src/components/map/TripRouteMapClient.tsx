"use client";

import "leaflet/dist/leaflet.css";

import { divIcon } from "leaflet";
import { useEffect, useRef, useState } from "react";
import { MapContainer, Marker, Polyline, TileLayer, ZoomControl, useMap } from "react-leaflet";
import { Pause, Play } from "lucide-react";

import type { RoutePoint } from "@/lib/fleetHistory";

type Props = { route: RoutePoint[] };

function carIcon(color: string) {
  return divIcon({
    className: "",
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function FitRoute({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || positions.length < 2) return;
    map.fitBounds(positions as [number, number][], { padding: [20, 20], maxZoom: 15 });
    fitted.current = true;
  });
  return null;
}

export default function TripRouteMapClient({ route }: Props) {
  const positions = route
    .filter((p) => p.lat && p.lon)
    .map((p) => [p.lat, p.lon] as [number, number]);

  const [scrubIdx, setScrubIdx] = useState(positions.length - 1);
  const [playing, setPlaying] = useState(false);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setScrubIdx(positions.length - 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions.length]);

  useEffect(() => {
    if (playing) {
      playRef.current = setInterval(() => {
        setScrubIdx((i) => {
          if (i >= positions.length - 1) {
            setPlaying(false);
            return positions.length - 1;
          }
          return i + 1;
        });
      }, 80);
    } else {
      if (playRef.current) clearInterval(playRef.current);
    }
    return () => { if (playRef.current) clearInterval(playRef.current); };
  }, [playing, positions.length]);

  if (positions.length < 2) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg bg-brand-cloud text-sm text-slate-400">
        Not enough GPS points to draw route
      </div>
    );
  }

  const center = positions[Math.floor(positions.length / 2)];
  const replayPos = positions[Math.min(scrubIdx, positions.length - 1)];
  const drawnPositions = positions.slice(0, scrubIdx + 1);
  const point = route[Math.min(scrubIdx, route.length - 1)];
  const speedMph = point ? Math.round(Number(point.speed_kph ?? 0) * 0.621371) : 0;
  const timestamp = point?.time ? new Date(point.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <div className="rounded-lg overflow-hidden border border-brand-line">
      <div className="h-48 relative">
        <MapContainer
          center={center}
          zoom={13}
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
          scrollWheelZoom={false}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <FitRoute positions={positions} />
          <Polyline positions={positions} pathOptions={{ color: "#cbd5e1", weight: 2, opacity: 0.5 }} />
          <Polyline positions={drawnPositions} pathOptions={{ color: "#15803d", weight: 3, opacity: 0.9 }} />
          <Marker position={replayPos} icon={carIcon("#173754")} />
          <ZoomControl position="bottomright" />
        </MapContainer>
      </div>

      {/* Scrubber */}
      <div className="bg-white px-4 py-2.5 flex items-center gap-3">
        <button
          onClick={() => {
            if (scrubIdx >= positions.length - 1) setScrubIdx(0);
            setPlaying((v) => !v);
          }}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-navy text-white hover:bg-brand-forest"
        >
          {playing ? <Pause size={12} /> : <Play size={12} />}
        </button>
        <input
          type="range"
          min={0}
          max={positions.length - 1}
          value={scrubIdx}
          onChange={(e) => { setPlaying(false); setScrubIdx(Number(e.target.value)); }}
          className="flex-1 accent-brand-navy h-1.5"
        />
        <div className="shrink-0 text-right">
          <p className="text-xs font-semibold text-brand-ink">{timestamp}</p>
          <p className="text-xs text-slate-400">{speedMph > 2 ? `${speedMph} mph` : "stopped"}</p>
        </div>
      </div>
    </div>
  );
}
