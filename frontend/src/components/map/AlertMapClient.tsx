"use client";

import "leaflet/dist/leaflet.css";

import { divIcon } from "leaflet";
import { useEffect, useRef } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, ZoomControl, useMap } from "react-leaflet";

import type { FleetAlert } from "@/lib/fleetHistory";

const TYPE_COLORS: Record<string, string> = {
  hard_brake: "#dc2626",
  rapid_accel: "#d97706",
  speeding: "#ea580c",
};

function alertIcon(type: string) {
  const color = TYPE_COLORS[type] ?? "#64748b";
  return divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 1px 6px rgba(0,0,0,0.3)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function FitAlerts({ points }: { points: [number, number][] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
    } else {
      map.fitBounds(points, { padding: [40, 40], maxZoom: 14 });
    }
    fitted.current = true;
  });
  return null;
}

const TYPE_LABEL: Record<string, string> = {
  hard_brake: "Hard brake",
  rapid_accel: "Rapid accel",
  speeding: "Speeding",
};

export default function AlertMapClient({ alerts }: { alerts: FleetAlert[] }) {
  const mapped = alerts.filter((a) => a.lat != null && a.lon != null);

  if (mapped.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        No alerts with GPS coordinates
      </div>
    );
  }

  const points = mapped.map((a) => [a.lat!, a.lon!] as [number, number]);
  const center = points[0];

  return (
    <MapContainer
      center={center}
      zoom={12}
      zoomControl={false}
      scrollWheelZoom
      style={{ height: "100%", width: "100%" }}
      attributionControl={false}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <ZoomControl position="bottomright" />
      <FitAlerts points={points} />
      {mapped.map((alert) => (
        <Marker
          key={alert.id}
          position={[alert.lat!, alert.lon!]}
          icon={alertIcon(alert.type)}
        >
          <Tooltip direction="top" offset={[0, -8]} opacity={1}>
            <div className="text-xs leading-snug">
              <p className="font-semibold">{TYPE_LABEL[alert.type] ?? alert.type}</p>
              <p className="text-slate-500">{new Date(alert.time).toLocaleString()}</p>
            </div>
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
