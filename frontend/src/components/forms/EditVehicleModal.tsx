"use client";

import { Camera, Trash2, X } from "lucide-react";
import { ChangeEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { featureCatalog } from "@/data/mockData";

const VEHICLE_COLORS = [
  { name: "White",   hex: "#FFFFFF" },
  { name: "Silver",  hex: "#C8CBD4" },
  { name: "Gray",    hex: "#64748B" },
  { name: "Black",   hex: "#1E293B" },
  { name: "Red",     hex: "#DC2626" },
  { name: "Blue",    hex: "#2563EB" },
  { name: "Navy",    hex: "#173754" },
  { name: "Green",   hex: "#16A34A" },
  { name: "Yellow",  hex: "#FBBF24" },
  { name: "Orange",  hex: "#F97316" },
  { name: "Maroon",  hex: "#9F1239" },
  { name: "Brown",   hex: "#78350F" },
];
import { useAllTrackers } from "@/lib/liveTracker";
import { useWorkspace } from "@/lib/workspace";
import type { Vehicle } from "@/types";

import { Button } from "../ui/Button";

const vehicleTypes = [
  "Van", "Pickup Truck", "Box Truck", "Service Truck",
  "Tow Truck", "Car", "SUV", "Motorcycle", "Trailer", "Other",
];

async function resizeImage(file: File, maxDim = 220): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("canvas unavailable")); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function EditVehicleModal({
  vehicle,
  open,
  onClose,
}: {
  vehicle: Vehicle;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { updateVehicle, removeVehicle } = useWorkspace();
  const liveTrackers = useAllTrackers();

  const [form, setForm] = useState({
    name: vehicle.name,
    vehicleNumber: vehicle.vehicleNumber,
    plate: vehicle.plate,
    make: vehicle.make,
    model: vehicle.model,
    year: String(vehicle.year),
    type: vehicle.type,
    notes: vehicle.notes,
    installDate: vehicle.installDate,
    deviceAssignment: vehicle.deviceAssignment ?? "",
  });
  const [photo, setPhoto] = useState<string | null>(vehicle.photo ?? null);
  const [vehicleColor, setVehicleColor] = useState<string>(vehicle.color ?? "");
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(vehicle.enabledFeatures);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function toggleFeature(feature: string) {
    setSelectedFeatures((current) =>
      current.includes(feature) ? current.filter((f) => f !== feature) : [...current, feature],
    );
  }

  async function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try { setPhoto(await resizeImage(file)); } catch {}
    e.target.value = "";
  }

  function handleSave() {
    updateVehicle(vehicle.id, {
      name: form.name.trim() || vehicle.name,
      vehicleNumber: form.vehicleNumber || vehicle.vehicleNumber,
      plate: form.plate,
      make: form.make,
      model: form.model,
      year: Number(form.year) || vehicle.year,
      type: form.type,
      notes: form.notes,
      installDate: form.installDate,
      deviceAssignment: form.deviceAssignment.trim() || "Not assigned",
      enabledFeatures: selectedFeatures,
      photo: photo ?? undefined,
      color: vehicleColor || undefined,
    });
    onClose();
  }

  function handleDelete() {
    removeVehicle(vehicle.id);
    onClose();
    router.replace("/vehicles");
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-brand-ink/45 px-4">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white shadow-panel">
        <div className="sticky top-0 flex items-center justify-between border-b border-brand-line bg-white px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-brand-ink">Edit Vehicle</h3>
            <p className="text-sm text-slate-500">{vehicle.name}</p>
          </div>
          <button onClick={onClose} className="rounded-md border border-brand-line p-2">
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-2">
          {/* Photo */}
          <div className="md:col-span-2">
            <p className="text-sm font-medium text-brand-text">Vehicle photo</p>
            <div className="mt-2 flex items-center gap-4">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-brand-line bg-brand-cloud flex items-center justify-center">
                {photo ? (
                  <img src={photo} alt="Preview" className="h-full w-full object-cover" />
                ) : (
                  <Camera size={20} className="text-slate-400" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <input id="edit-vehicle-photo" type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                <label htmlFor="edit-vehicle-photo" className="cursor-pointer inline-flex h-9 items-center rounded-md border border-brand-line bg-white px-3 text-sm font-medium text-brand-text hover:bg-brand-cloud">
                  {photo ? "Change photo" : "Upload photo"}
                </label>
                {photo && (
                  <button type="button" onClick={() => setPhoto(null)} className="text-sm text-slate-400 hover:text-red-500">
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Vehicle color */}
          <div className="md:col-span-2">
            <p className="text-sm font-medium text-brand-text">Vehicle color <span className="text-xs font-normal text-slate-400">— shown on the fleet map</span></p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                title="None"
                onClick={() => setVehicleColor("")}
                className={`h-7 w-7 rounded-full border-2 flex items-center justify-center text-xs text-slate-400 bg-slate-100 transition-transform hover:scale-110 ${!vehicleColor ? "border-brand-navy scale-110" : "border-slate-200"}`}
              >
                —
              </button>
              {VEHICLE_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  title={c.name}
                  onClick={() => setVehicleColor(c.hex)}
                  className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${vehicleColor === c.hex ? "border-brand-navy scale-110" : c.hex === "#FFFFFF" ? "border-slate-300" : "border-transparent"}`}
                  style={{ background: c.hex }}
                />
              ))}
            </div>
          </div>

          {(
            [
              ["Vehicle name", "name"],
              ["Vehicle number", "vehicleNumber"],
              ["Plate number", "plate"],
              ["Make", "make"],
              ["Model", "model"],
              ["Year", "year"],
            ] as [string, string][]
          ).map(([label, key]) => (
            <label key={key} className="text-sm font-medium text-brand-text">
              {label}
              <input
                className="mt-2 h-11 w-full rounded-md border border-brand-line px-3"
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            </label>
          ))}

          <label className="text-sm font-medium text-brand-text">
            Vehicle type
            <select
              className="mt-2 h-11 w-full rounded-md border border-brand-line px-3"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            >
              {vehicleTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>

          <label className="text-sm font-medium text-brand-text">
            Install date
            <input
              type="date"
              className="mt-2 h-11 w-full rounded-md border border-brand-line px-3"
              value={form.installDate}
              onChange={(e) => setForm((f) => ({ ...f, installDate: e.target.value }))}
            />
          </label>

          <label className="md:col-span-2 text-sm font-medium text-brand-text">
            Notes
            <textarea
              rows={3}
              className="mt-2 w-full rounded-md border border-brand-line px-3 py-3"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </label>

          <div className="md:col-span-2">
            <p className="text-sm font-medium text-brand-text">Tracker device ID</p>
            <p className="mt-0.5 text-xs text-slate-400 mb-2">Links this vehicle to a GPS tracker. Leave blank if no tracker is installed.</p>
            <input
              className="h-11 w-full rounded-md border border-brand-line px-3 font-mono text-sm"
              value={form.deviceAssignment === "Not assigned" ? "" : form.deviceAssignment}
              onChange={(e) => setForm((f) => ({ ...f, deviceAssignment: e.target.value }))}
              placeholder="e.g. tracker-002"
            />
            {liveTrackers.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="text-xs text-slate-400 self-center">Online trackers:</span>
                {liveTrackers.map((t) => (
                  <button
                    key={t.device_id}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, deviceAssignment: t.device_id }))}
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-mono transition-colors ${
                      form.deviceAssignment === t.device_id
                        ? "bg-brand-navy border-brand-navy text-white"
                        : "border-brand-line bg-brand-cloud text-slate-600 hover:border-brand-navy"
                    }`}
                  >
                    {t.device_id}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="md:col-span-2">
            <p className="text-sm font-medium text-brand-text">Features enabled</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {featureCatalog.map((feature) => (
                <label key={feature} className="flex items-center gap-2 rounded-md border border-brand-line px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-brand-line"
                    checked={selectedFeatures.includes(feature)}
                    onChange={() => toggleFeature(feature)}
                  />
                  <span>{feature}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-brand-line px-6 py-4">
          {confirmDelete ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-red-600 font-medium">Delete this vehicle?</span>
              <button onClick={handleDelete} className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
                Yes, delete
              </button>
              <button onClick={() => setConfirmDelete(false)} className="text-sm text-slate-400 hover:text-brand-ink">
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-2 rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-50"
            >
              <Trash2 size={14} /> Delete vehicle
            </button>
          )}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave}>Save changes</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
