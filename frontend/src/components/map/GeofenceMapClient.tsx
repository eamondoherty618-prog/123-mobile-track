"use client";

import "leaflet/dist/leaflet.css";

import { divIcon } from "leaflet";
import { Circle, MapContainer, Marker, TileLayer, Tooltip, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import { useEffect } from "react";

import { useAllTrackers } from "@/lib/liveTracker";
import { useWorkspace } from "@/lib/workspace";
import type { Geofence } from "@/types";

function pinIcon() {
  return divIcon({
    className: "",
    html: `<div style="width:16px;height:16px;border-radius:50%;background:#f97316;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function vehicleDot(color: string) {
  return divIcon({
    className: "",
    html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.2)"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

function FlyTo({ coords }: { coords: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.flyTo(coords, Math.max(map.getZoom(), 15), { duration: 0.8 });
  }, [coords, map]);
  return null;
}

function ClickHandler({ onMapClick }: { onMapClick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function GeofenceMapClient({
  geofences,
  pendingPin,
  pendingRadius,
  onMapClick,
  flyTo,
}: {
  geofences: Geofence[];
  pendingPin: { lat: number; lon: number } | null;
  pendingRadius: number;
  onMapClick: (lat: number, lon: number) => void;
  flyTo?: [number, number] | null;
}) {
  const { serviceArea } = useWorkspace();
  const allTrackers = useAllTrackers();
  const { state } = useWorkspace();

  const vehicleMarkers = allTrackers
    .filter((t) => t.has_fix && t.gps?.lat && t.gps?.lon)
    .map((t) => {
      const vehicle = state.vehicles.find((v) => v.deviceAssignment === t.device_id);
      return {
        id: t.device_id,
        name: vehicle?.name ?? t.device_id,
        lat: Number(t.gps!.lat),
        lon: Number(t.gps!.lon),
      };
    });

  const center: [number, number] = pendingPin
    ? [pendingPin.lat, pendingPin.lon]
    : geofences[0]
    ? [geofences[0].lat, geofences[0].lon]
    : serviceArea.center;

  return (
    <MapContainer
      center={center}
      zoom={13}
      zoomControl={false}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ZoomControl position="bottomright" />
      <ClickHandler onMapClick={onMapClick} />
      <FlyTo coords={flyTo ?? null} />

      {/* Existing geofence circles */}
      {geofences.map((geo) => (
        <Circle
          key={geo.id}
          center={[geo.lat, geo.lon]}
          radius={geo.radiusM}
          pathOptions={{ color: "#173754", fillColor: "#173754", fillOpacity: 0.1, weight: 2 }}
        >
          <Tooltip direction="top" permanent sticky>
            <span className="text-xs font-semibold">{geo.name}</span>
          </Tooltip>
        </Circle>
      ))}

      {/* Pending / preview circle */}
      {pendingPin && (
        <>
          <Circle
            center={[pendingPin.lat, pendingPin.lon]}
            radius={pendingRadius}
            pathOptions={{ color: "#f97316", fillColor: "#f97316", fillOpacity: 0.1, weight: 2, dashArray: "6 4" }}
          />
          <Marker position={[pendingPin.lat, pendingPin.lon]} icon={pinIcon()}>
            <Tooltip direction="top" permanent>
              <span className="text-xs text-slate-500">New zone center</span>
            </Tooltip>
          </Marker>
        </>
      )}

      {/* Live vehicle positions */}
      {vehicleMarkers.map((v) => (
        <Marker key={v.id} position={[v.lat, v.lon]} icon={vehicleDot("#15803d")}>
          <Tooltip direction="top">
            <span className="text-xs font-semibold">{v.name}</span>
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
