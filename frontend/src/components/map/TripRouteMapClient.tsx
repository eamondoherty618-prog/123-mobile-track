"use client";

import "leaflet/dist/leaflet.css";

import { MapContainer, Polyline, TileLayer, ZoomControl } from "react-leaflet";

import type { RoutePoint } from "@/lib/fleetHistory";

type Props = { route: RoutePoint[] };

export default function TripRouteMapClient({ route }: Props) {
  const positions = route
    .filter((p) => p.lat && p.lon)
    .map((p) => [p.lat, p.lon] as [number, number]);

  if (positions.length < 2) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg bg-brand-cloud text-sm text-slate-400">
        Not enough GPS points to draw route
      </div>
    );
  }

  const center = positions[Math.floor(positions.length / 2)];

  return (
    <div className="h-48 overflow-hidden rounded-lg">
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
        scrollWheelZoom={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Polyline positions={positions} pathOptions={{ color: "#15803d", weight: 3, opacity: 0.85 }} />
        <ZoomControl position="bottomright" />
      </MapContainer>
    </div>
  );
}
