"use client";

import "leaflet/dist/leaflet.css";

import { createVehicleMapIcon } from "@/lib/vehicleMapIcon";
import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, ZoomControl, useMap } from "react-leaflet";

import { useAllTrackers } from "@/lib/liveTracker";
import { useWorkspace } from "@/lib/workspace";
import { MaintenanceItem } from "@/types";

import { SectionCard } from "../ui/SectionCard";

// Fly to a selected vehicle whenever selectedVehicleId changes.
function FlyToVehicle({
  selectedVehicleId,
  markers,
}: {
  selectedVehicleId?: string;
  markers: Array<{ vehicleId?: string; id: string; point: [number, number] }>;
}) {
  const map = useMap();
  const prevId = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!selectedVehicleId || selectedVehicleId === prevId.current) return;
    prevId.current = selectedVehicleId;
    const marker = markers.find((m) => m.vehicleId === selectedVehicleId || m.id === selectedVehicleId);
    if (marker) map.flyTo(marker.point, Math.max(map.getZoom(), 15), { duration: 0.8 });
  }, [selectedVehicleId, markers, map]);
  return null;
}

// Fit map to all GPS markers the first time they appear, then leave it alone.
function FitBoundsOnce({ points }: { points: [number, number][] }) {
  const map = useMap();
  const hasFit = useRef(false);
  useEffect(() => {
    if (hasFit.current || points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 16);
    } else {
      map.fitBounds(points as [number, number][], { padding: [60, 60], maxZoom: 16 });
    }
    hasFit.current = true;
  });
  return null;
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
        color: vehicle?.color,
        type: vehicle?.type ?? "Car",
        point: [Number(t.gps!.lat), Number(t.gps!.lon)] as [number, number],
        speedMph,
        selected,
        maintDue: isMaintenanceDue(maintItems),
      };
    });

  // Vehicles without current fix but with a last-known location
  const lastKnownMarkers = allTrackers
    .filter((t) => !t.has_fix && t.last_gps?.lat && t.last_gps?.lon)
    .map((t) => {
      const vehicle = state.vehicles.find((v) => v.deviceAssignment === t.device_id);
      return {
        id: t.device_id,
        vehicleId: vehicle?.id,
        name: vehicle?.name ?? t.device_id,
        photo: vehicle?.photo,
        color: vehicle?.color,
        type: vehicle?.type ?? "Car",
        point: [Number(t.last_gps!.lat), Number(t.last_gps!.lon)] as [number, number],
        time: t.last_gps?.time,
      };
    });

  const hasGps = liveMarkers.length > 0;
  const center: [number, number] = liveMarkers[0]?.point ?? lastKnownMarkers[0]?.point ?? serviceArea.center;

  // Status rows for overlay — one row per tracker, labelled by vehicle name if assigned.
  // Deduplicate: if two trackers resolve to the same vehicle name, only keep the one that's live.
  const statusRows = useMemo(() => {
    const rows = allTrackers.map((t) => {
      const vehicle = state.vehicles.find((v) => v.deviceAssignment === t.device_id);
      const name = vehicle?.name ?? t.device_id;
      const live = Boolean(t.has_fix && t.gps?.lat && t.gps?.lon);
      const online = isRecentReport(t.received_at);
      const speedMph = live ? Math.round(Number(t.gps?.speed_kph ?? 0) * 0.621371) : 0;
      return { id: t.device_id, name, live, online, speedMph, hasVehicle: Boolean(vehicle) };
    });
    // If a tracker is unassigned (no vehicle) but its device_id matches a name already
    // shown by an assigned tracker, skip it to avoid duplicate labels.
    const assignedNames = new Set(rows.filter((r) => r.hasVehicle).map((r) => r.name));
    return rows.filter((r) => r.hasVehicle || !assignedNames.has(r.id));
  }, [allTrackers, state.vehicles]);

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
          <FlyToVehicle
            selectedVehicleId={selectedVehicleId}
            markers={[...liveMarkers, ...lastKnownMarkers]}
          />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {liveMarkers.map((m) => (
            <Marker
              key={m.id}
              position={m.point}
              icon={createVehicleMapIcon({
                vehicleType: m.type,
                vehicleColor: m.color,
                photo: m.photo,
                isMoving: m.speedMph > 3,
                isOnline: true,
                selected: m.selected,
                maintDue: m.maintDue,
              })}
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

          {lastKnownMarkers.map((m) => (
            <Marker
              key={`last-${m.id}`}
              position={m.point}
              opacity={0.5}
              icon={createVehicleMapIcon({
                vehicleType: m.type,
                vehicleColor: m.color,
                photo: m.photo,
                isMoving: false,
                isOnline: false,
              })}
              eventHandlers={{
                click: () => onSelectVehicle?.(m.vehicleId ?? m.id),
              }}
            >
              <Tooltip direction="top" offset={[0, -12]} opacity={1} permanent={false}>
                <div className="text-xs leading-snug">
                  <p className="font-semibold">{m.name}</p>
                  <p className="text-slate-500">
                    Last known ·{" "}
                    {m.time
                      ? new Date(m.time).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                      : "unknown time"}
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
