"use client";

import "leaflet/dist/leaflet.css";

import { divIcon } from "leaflet";
import { useEffect, useRef } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, ZoomControl, useMap } from "react-leaflet";

import { useAllTrackers } from "@/lib/liveTracker";
import { useWorkspace } from "@/lib/workspace";
import { MaintenanceItem } from "@/types";

import { SectionCard } from "../ui/SectionCard";

// Fit map to all GPS markers the first time they appear, then leave it alone.
function FitBoundsOnce({ points }: { points: [number, number][] }) {
  const map = useMap();
  const hasFit = useRef(false);
  useEffect(() => {
    if (hasFit.current || points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
    } else {
      map.fitBounds(points as [number, number][], { padding: [50, 50], maxZoom: 15 });
    }
    hasFit.current = true;
  });
  return null;
}

function maintDueBadge(due: boolean): string {
  if (!due) return "";
  return `<div style="position:absolute;top:-4px;right:-4px;width:14px;height:14px;border-radius:50%;background:#f97316;border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:8px;line-height:1">⚙</div>`;
}

function dotIcon(color: string, size = 16, maintDue = false) {
  const half = size / 2;
  const outer = size + 8;
  return divIcon({
    className: "",
    html: `<div style="position:relative;width:${outer}px;height:${outer}px"><div style="position:absolute;top:4px;left:4px;width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.25)"></div>${maintDueBadge(maintDue)}</div>`,
    iconSize: [outer, outer],
    iconAnchor: [outer / 2, outer / 2],
  });
}

function photoIcon(photo: string, color: string, size = 40, maintDue = false) {
  const half = size / 2;
  const outer = size + 8;
  return divIcon({
    className: "",
    html: `<div style="position:relative;width:${outer}px;height:${outer}px"><div style="position:absolute;top:4px;left:4px;width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;border:3px solid ${color};box-shadow:0 2px 10px rgba(0,0,0,0.3)"><img src="${photo}" style="width:100%;height:100%;object-fit:cover"/></div>${maintDueBadge(maintDue)}</div>`,
    iconSize: [outer, outer],
    iconAnchor: [outer / 2, outer / 2],
  });
}

function isMaintenanceDue(items: MaintenanceItem[]): boolean {
  const now = Date.now();
  return items.some((item) => {
    if (!item.alertEnabled) return false;
    if (item.intervalMonths > 0) {
      const mo = (now - new Date(item.lastServiceDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
      if (mo >= item.intervalMonths * 0.85) return true;
    }
    return false;
  });
}

function isRecentReport(receivedAt: string | undefined): boolean {
  if (!receivedAt) return false;
  return Date.now() - new Date(receivedAt).getTime() < 5 * 60 * 1000;
}

export function LiveFleetMapClient({
  selectedVehicleId,
  onSelectVehicle,
}: {
  selectedVehicleId?: string;
  onSelectVehicle?: (vehicleId: string) => void;
}) {
  const { state, serviceArea } = useWorkspace();
  const allTrackers = useAllTrackers();

  // Vehicles with live GPS fix
  const liveMarkers = allTrackers
    .filter((t) => t.has_fix && t.gps?.lat && t.gps?.lon)
    .map((t) => {
      const vehicle = state.vehicles.find((v) => v.deviceAssignment === t.device_id);
      const speedMph = Math.round(Number(t.gps?.speed_kph ?? 0) * 0.621371);
      const selected =
        selectedVehicleId === vehicle?.id || selectedVehicleId === t.device_id;
      const maintItems = vehicle
        ? state.maintenanceItems.filter((m) => m.vehicleId === vehicle.id)
        : [];
      return {
        id: t.device_id,
        vehicleId: vehicle?.id,
        name: vehicle?.name ?? t.device_id,
        photo: vehicle?.photo,
        point: [Number(t.gps!.lat), Number(t.gps!.lon)] as [number, number],
        speedMph,
        selected,
        maintDue: isMaintenanceDue(maintItems),
      };
    });

  const hasGps = liveMarkers.length > 0;
  const center: [number, number] = liveMarkers[0]?.point ?? serviceArea.center;

  // Status rows for overlay (all trackers, GPS or not)
  const statusRows = allTrackers.map((t) => {
    const vehicle = state.vehicles.find((v) => v.deviceAssignment === t.device_id);
    const name = vehicle?.name ?? t.device_id;
    const live = Boolean(t.has_fix && t.gps?.lat && t.gps?.lon);
    const online = isRecentReport(t.received_at);
    const speedMph = live ? Math.round(Number(t.gps?.speed_kph ?? 0) * 0.621371) : 0;
    return { id: t.device_id, name, live, online, speedMph };
  });

  return (
    <SectionCard className="overflow-hidden">
      <div className="border-b border-brand-line px-5 py-4">
        <h2 className="text-lg font-semibold text-brand-ink">Live map</h2>
        <p className="text-sm text-slate-500">
          {hasGps
            ? `${liveMarkers.length} vehicle${liveMarkers.length > 1 ? "s" : ""} with GPS fix · updates every 15 s`
            : "Vehicle locations appear once trackers have a GPS fix outdoors."}
        </p>
      </div>

      <div className="relative h-[460px]">
        <MapContainer
          center={center}
          zoom={hasGps ? 13 : 10}
          zoomControl={false}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom
        >
          <ZoomControl position="bottomright" />
          <FitBoundsOnce points={liveMarkers.map((m) => m.point)} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {liveMarkers.map((m) => (
            <Marker
              key={m.id}
              position={m.point}
              icon={
                m.photo
                  ? photoIcon(m.photo, m.selected ? "#15803d" : "#173754", 40, m.maintDue)
                  : dotIcon(m.selected ? "#15803d" : "#173754", 16, m.maintDue)
              }
              eventHandlers={{
                click: () => onSelectVehicle?.(m.vehicleId ?? m.id),
              }}
            >
              <Tooltip direction="top" offset={[0, -12]} opacity={1} permanent={false}>
                <div className="text-xs leading-snug">
                  <p className="font-semibold">{m.name}</p>
                  <p className="text-slate-500">
                    {m.speedMph > 3 ? `${m.speedMph} mph` : "Stopped"} · Live GPS
                  </p>
                </div>
              </Tooltip>
            </Marker>
          ))}
        </MapContainer>

        {/* Status overlay — always visible, shows every tracker */}
        <div className="pointer-events-none absolute bottom-4 left-4 right-4 rounded-lg border border-white/70 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
          {statusRows.length === 0 ? (
            <p className="text-sm text-slate-400">No trackers online yet.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
              {statusRows.map((row) => (
                <span key={row.id} className="inline-flex items-center gap-1.5 text-xs">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      row.live
                        ? "bg-brand-navy"
                        : row.online
                        ? "bg-amber-400"
                        : "bg-slate-300"
                    }`}
                  />
                  <span className="font-medium text-brand-ink">{row.name}</span>
                  <span className="text-slate-400">
                    {row.live
                      ? row.speedMph > 3
                        ? `${row.speedMph} mph`
                        : "stopped"
                      : row.online
                      ? "no GPS fix"
                      : "offline"}
                  </span>
                </span>
              ))}
              {!hasGps && (
                <span className="text-xs text-slate-400 ml-auto">
                  Take trackers outdoors for GPS
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
