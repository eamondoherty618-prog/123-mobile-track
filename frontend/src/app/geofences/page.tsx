"use client";

import dynamic from "next/dynamic";
import { MapPin, Plus, Search, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { useWorkspace } from "@/lib/workspace";
import type { Geofence } from "@/types";

const GeofenceMapClient = dynamic(
  () => import("@/components/map/GeofenceMapClient"),
  { ssr: false, loading: () => <div className="h-96 animate-pulse rounded-lg bg-brand-cloud" /> },
);

const TRIGGER_LABELS = { enter: "On enter", exit: "On exit", both: "Enter & exit" };

export default function GeofencesPage() {
  const { state, serviceArea, addGeofence, removeGeofence, updateGeofence } = useWorkspace();
  const geofences = state.geofences ?? [];

  const [showForm, setShowForm] = useState(false);
  const [pendingPin, setPendingPin] = useState<{ lat: number; lon: number } | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [radiusM, setRadiusM] = useState(200);
  const [triggerOn, setTriggerOn] = useState<Geofence["triggerOn"]>("both");
  const [alertEnabled, setAlertEnabled] = useState(true);
  const [notes, setNotes] = useState("");
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Address search
  const [addressQuery, setAddressQuery] = useState("");
  const [addressResults, setAddressResults] = useState<{ display_name: string; lat: string; lon: string }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function searchAddress(q: string) {
    setAddressQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!q.trim()) { setAddressResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`);
        const data = await res.json();
        setAddressResults(data);
      } catch { setAddressResults([]); }
      setSearchLoading(false);
    }, 400);
  }

  function pickAddressResult(result: { display_name: string; lat: string; lon: string }) {
    const coords: [number, number] = [Number(result.lat), Number(result.lon)];
    setPendingPin({ lat: coords[0], lon: coords[1] });
    setFlyTo(coords);
    setAddressQuery(result.display_name.split(",")[0]);
    setAddressResults([]);
  }

  function openAdd() {
    setEditId(null);
    setName("");
    setRadiusM(200);
    setTriggerOn("both");
    setAlertEnabled(true);
    setNotes("");
    setSelectedVehicleIds([]);
    setAddressQuery("");
    setAddressResults([]);
    setFlyTo(null);
    setShowForm(true);
  }

  function openEdit(geo: Geofence) {
    setEditId(geo.id);
    setName(geo.name);
    setRadiusM(geo.radiusM);
    setTriggerOn(geo.triggerOn);
    setAlertEnabled(geo.alertEnabled);
    setNotes(geo.notes);
    setSelectedVehicleIds(geo.vehicleIds ?? []);
    setAddressQuery("");
    setAddressResults([]);
    setFlyTo([geo.lat, geo.lon]);
    setShowForm(true);
  }

  function handleMapClick(lat: number, lon: number) {
    if (!showForm) return;
    setPendingPin({ lat, lon });
  }

  function handleSubmit() {
    if (!name.trim()) return;
    if (editId) {
      updateGeofence(editId, { name: name.trim(), radiusM, triggerOn, alertEnabled, notes, vehicleIds: selectedVehicleIds });
    } else {
      const pin = pendingPin ?? { lat: serviceArea.center[0], lon: serviceArea.center[1] };
      addGeofence({
        name: name.trim(),
        lat: pendingPin?.lat ?? pin.lat,
        lon: pendingPin?.lon ?? pin.lon,
        radiusM,
        triggerOn,
        alertEnabled,
        notes,
        vehicleIds: selectedVehicleIds,
      });
    }
    setShowForm(false);
    setPendingPin(null);
  }

  // Vehicles currently inside each geofence
  const { state: ws } = useWorkspace();
  const allTrackers = ws.vehicles; // We'll compute from live trackers via liveTracker hook in the map client

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold uppercase text-brand-forest">Geofences</p>
          <h1 className="mt-1 text-3xl font-bold text-brand-ink">Geofences</h1>
          <p className="mt-2 text-sm text-slate-500">
            Draw zones around job sites, depots, and restricted areas. Get alerts when vehicles enter or leave.
          </p>
        </div>
        <Button onClick={openAdd} className="flex items-center gap-1.5">
          <Plus size={15} /> Add zone
        </Button>
      </div>

      {/* Map */}
      <SectionCard className="overflow-hidden">
        <div className="border-b border-brand-line px-5 py-3">
          <h2 className="text-base font-semibold text-brand-ink">Zone map</h2>
          {showForm && !editId && (
            <p className="text-sm text-brand-navy mt-0.5">
              <MapPin size={12} className="inline mr-1" />
              Click the map to place the zone center
            </p>
          )}
        </div>
        <div className="h-96">
          <GeofenceMapClient
            geofences={geofences}
            pendingPin={pendingPin}
            pendingRadius={radiusM}
            onMapClick={handleMapClick}
            flyTo={flyTo}
          />
        </div>
      </SectionCard>

      {/* Add/edit form */}
      {showForm && (
        <SectionCard className="p-5">
          <h3 className="text-base font-semibold text-brand-ink mb-4">
            {editId ? "Edit zone" : "New zone"}
            {!editId && !pendingPin && (
              <span className="ml-2 text-sm font-normal text-slate-400">← search an address or click map to place</span>
            )}
          </h3>

          {/* Address search */}
          {!editId && (
            <div className="mb-4 relative">
              <label className="mb-1.5 block text-sm font-medium text-brand-ink">Search by address</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={addressQuery}
                  onChange={(e) => searchAddress(e.target.value)}
                  placeholder="Street, city, or landmark…"
                  className="h-10 w-full rounded-md border border-brand-line bg-brand-cloud pl-8 pr-3 text-sm outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
                />
              </div>
              {(addressResults.length > 0 || searchLoading) && (
                <div className="absolute z-10 mt-1 w-full rounded-md border border-brand-line bg-white shadow-lg">
                  {searchLoading ? (
                    <p className="px-3 py-2 text-sm text-slate-400">Searching…</p>
                  ) : (
                    addressResults.map((r, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => pickAddressResult(r)}
                        className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-brand-cloud"
                      >
                        <MapPin size={13} className="mt-0.5 shrink-0 text-brand-navy" />
                        <span className="truncate">{r.display_name}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
              {pendingPin && (
                <p className="mt-1.5 text-xs text-brand-forest">
                  ✓ Zone placed — you can also click the map to adjust
                </p>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brand-ink">Zone name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Depot, Job site A, etc."
                className="h-10 w-full rounded-md border border-brand-line bg-brand-cloud px-3 text-sm outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brand-ink">Radius (feet)</label>
              <input
                type="number"
                value={Math.round(radiusM * 3.28084)}
                onChange={(e) => setRadiusM(Math.max(50, Math.round(Number(e.target.value) / 3.28084)))}
                min={150}
                step={50}
                className="h-10 w-full rounded-md border border-brand-line bg-brand-cloud px-3 text-sm outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brand-ink">Trigger on</label>
              <select
                value={triggerOn}
                onChange={(e) => setTriggerOn(e.target.value as Geofence["triggerOn"])}
                className="h-10 w-full rounded-md border border-brand-line bg-brand-cloud px-3 text-sm outline-none focus:border-brand-navy"
              >
                <option value="enter">Enter</option>
                <option value="exit">Exit</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brand-ink">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
                className="h-10 w-full rounded-md border border-brand-line bg-brand-cloud px-3 text-sm outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
              />
            </div>
          </div>
          {/* Vehicle assignment */}
          {state.vehicles.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-brand-ink">
                Apply to vehicles
                <span className="ml-1.5 text-xs font-normal text-slate-400">(leave empty for all)</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {state.vehicles.map((v) => {
                  const selected = selectedVehicleIds.includes(v.id);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() =>
                        setSelectedVehicleIds((ids) =>
                          selected ? ids.filter((id) => id !== v.id) : [...ids, v.id],
                        )
                      }
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        selected
                          ? "bg-brand-navy border-brand-navy text-white"
                          : "border-brand-line bg-brand-cloud text-slate-600 hover:border-brand-navy"
                      }`}
                    >
                      {v.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-brand-ink cursor-pointer select-none">
              <input
                type="checkbox"
                checked={alertEnabled}
                onChange={(e) => setAlertEnabled(e.target.checked)}
                className="rounded accent-brand-navy"
              />
              Send alert on trigger
            </label>
          </div>
          <div className="mt-5 flex gap-3">
            <Button onClick={handleSubmit} disabled={!name.trim() || (!editId && !pendingPin)}>
              {editId ? "Save changes" : "Add zone"}
            </Button>
            <button
              onClick={() => { setShowForm(false); setPendingPin(null); }}
              className="rounded-md border border-brand-line px-4 py-2 text-sm text-slate-500 hover:bg-brand-cloud"
            >
              Cancel
            </button>
          </div>
        </SectionCard>
      )}

      {/* Zone list */}
      {geofences.length === 0 && !showForm ? (
        <SectionCard className="p-10 text-center">
          <MapPin size={28} className="mx-auto mb-4 text-slate-300" />
          <p className="text-base font-semibold text-brand-ink">No zones yet</p>
          <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
            Add your first geofence to get arrival and departure alerts for any location.
          </p>
          <Button onClick={openAdd} className="mt-4 inline-flex items-center gap-1.5">
            <Plus size={15} /> Add first zone
          </Button>
        </SectionCard>
      ) : geofences.length > 0 ? (
        <SectionCard className="overflow-hidden">
          <div className="border-b border-brand-line px-5 py-3">
            <h2 className="text-base font-semibold text-brand-ink">
              {geofences.length} zone{geofences.length !== 1 ? "s" : ""}
            </h2>
          </div>
          <div className="divide-y divide-brand-line">
            {geofences.map((geo) => (
              <div key={geo.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-brand-navy opacity-70" />
                    <p className="font-semibold text-brand-ink">{geo.name}</p>
                    {geo.alertEnabled && (
                      <span className="rounded-full bg-brand-mint px-2 py-0.5 text-xs font-semibold text-brand-forest">alerts on</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {TRIGGER_LABELS[geo.triggerOn]} · {Math.round(geo.radiusM * 3.28084)} ft radius
                    {geo.notes && ` · ${geo.notes}`}
                    {geo.vehicleIds?.length ? (
                      <> · {geo.vehicleIds.map((id) => state.vehicles.find((v) => v.id === id)?.name ?? id).join(", ")}</>
                    ) : (
                      <> · all vehicles</>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {confirmDeleteId === geo.id ? (
                    <>
                      <button
                        onClick={() => { removeGeofence(geo.id); setConfirmDeleteId(null); }}
                        className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-md border border-brand-line px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-brand-cloud"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => openEdit(geo)}
                        className="rounded-md border border-brand-line px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-brand-cloud"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(geo.id)}
                        className="rounded-md border border-red-200 p-1.5 text-red-400 hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
