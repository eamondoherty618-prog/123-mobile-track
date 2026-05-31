"use client";

import "leaflet/dist/leaflet.css";

import { MapContainer, Marker, TileLayer, Tooltip, ZoomControl } from "react-leaflet";

import { createVehicleMapIcon } from "@/lib/vehicleMapIcon";
import type { LiveTrackerPacket } from "@/lib/liveTracker";

export default function LiveVehicleMapClient({
  vehicleName,
  vehicleType,
  vehicleColor,
  photo,
  tracker,
}: {
  vehicleName: string;
  vehicleType?: string;
  vehicleColor?: string;
  photo?: string;
  tracker: LiveTrackerPacket | null;
}) {
  const hasGps = Boolean(tracker?.has_fix && tracker.gps?.lat && tracker.gps?.lon);
  const hasLastGps = !hasGps && Boolean(tracker?.last_gps?.lat && tracker?.last_gps?.lon);

  const lat = hasGps ? Number(tracker!.gps!.lat) : hasLastGps ? Number(tracker!.last_gps!.lat) : null;
  const lon = hasGps ? Number(tracker!.gps!.lon) : hasLastGps ? Number(tracker!.last_gps!.lon) : null;
  const speedMph = hasGps ? Math.round(Number(tracker!.gps?.speed_kph ?? 0) * 0.621371) : 0;

  if (lat === null || lon === null) {
    return (
      <div className="flex h-full items-center justify-center bg-brand-cloud text-sm text-slate-400">
        {tracker ? "No GPS fix — take vehicle outdoors" : "No tracker assigned"}
      </div>
    );
  }

  const center: [number, number] = [lat, lon];
  const icon = createVehicleMapIcon({
    vehicleType: vehicleType ?? "Car",
    vehicleColor,
    photo,
    isMoving: speedMph > 3,
    isOnline: hasGps,
  });
  const lastSeenStr = tracker?.last_gps?.time
    ? new Date(tracker.last_gps.time).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <MapContainer
      center={center}
      zoom={15}
      zoomControl={false}
      scrollWheelZoom={false}
      style={{ height: "100%", width: "100%", opacity: hasGps ? 1 : 0.7 }}
      attributionControl={false}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <ZoomControl position="bottomright" />
      <Marker position={center} icon={icon} opacity={hasGps ? 1 : 0.5}>
        <Tooltip direction="top" offset={[0, -14]} opacity={1} permanent>
          <div className="text-xs leading-snug">
            <p className="font-semibold">{vehicleName}</p>
            <p className="text-slate-500">
              {hasGps
                ? speedMph > 3 ? `${speedMph} mph` : "Stopped"
                : `Last known${lastSeenStr ? ` · ${lastSeenStr}` : ""}`}
            </p>
          </div>
        </Tooltip>
      </Marker>
    </MapContainer>
  );
}
