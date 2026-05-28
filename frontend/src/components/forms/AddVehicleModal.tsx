"use client";

import { Camera, X } from "lucide-react";
import { useState } from "react";

import { featureCatalog } from "@/data/mockData";
import { useWorkspace } from "@/lib/workspace";

import { Button } from "../ui/Button";

const vehicleTypes = [
  "Van",
  "Pickup Truck",
  "Box Truck",
  "Service Truck",
  "Tow Truck",
  "Car",
  "SUV",
  "Motorcycle",
  "Trailer",
  "Other",
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

const defaultForm = {
  name: "",
  vehicleNumber: "",
  plate: "",
  make: "",
  model: "",
  year: "2026",
  type: vehicleTypes[0],
  notes: "",
  installDate: "",
};

const defaultFeatures = ["GPS Tracking", "Live Location", "Motion Wake", "Smart Sleep Mode"];

export function AddVehicleModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { addVehicle, serviceArea, hasServiceArea } = useWorkspace();
  const [form, setForm] = useState(defaultForm);
  const [photo, setPhoto] = useState<string | null>(null);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(defaultFeatures);

  function toggleFeature(feature: string) {
    setSelectedFeatures((current) =>
      current.includes(feature) ? current.filter((item) => item !== feature) : [...current, feature],
    );
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const resized = await resizeImage(file);
      setPhoto(resized);
    } catch {
      // ignore — photo is optional
    }
    e.target.value = "";
  }

  if (!open) return null;

  const canSubmit = form.name.trim().length > 0;

  function handleSubmit() {
    addVehicle({
      name: form.name,
      vehicleNumber: form.vehicleNumber || "01",
      plate: form.plate || "Plate not added",
      make: form.make || "Make not added",
      model: form.model || "Model not added",
      year: Number(form.year) || new Date().getFullYear(),
      type: form.type,
      notes: form.notes,
      installDate: form.installDate,
      enabledFeatures: selectedFeatures,
      photo: photo ?? undefined,
    });
    onClose();
    setForm(defaultForm);
    setPhoto(null);
    setSelectedFeatures(defaultFeatures);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-ink/45 px-4">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white shadow-panel">
        <div className="sticky top-0 flex items-center justify-between border-b border-brand-line bg-white px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-brand-ink">Add Vehicle</h3>
            <p className="text-sm text-slate-500">Create a vehicle record and link tracking hardware when ready.</p>
          </div>
          <button onClick={onClose} className="rounded-md border border-brand-line p-2">
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-2">
          {/* Photo upload */}
          <div className="md:col-span-2">
            <p className="text-sm font-medium text-brand-text">Vehicle photo (optional)</p>
            <div className="mt-2 flex items-center gap-4">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-brand-line bg-brand-cloud flex items-center justify-center">
                {photo ? (
                  <img src={photo} alt="Preview" className="h-full w-full object-cover" />
                ) : (
                  <Camera size={20} className="text-slate-400" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="vehicle-photo-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
                <label
                  htmlFor="vehicle-photo-input"
                  className="cursor-pointer inline-flex h-9 items-center rounded-md border border-brand-line bg-white px-3 text-sm font-medium text-brand-text hover:bg-brand-cloud"
                >
                  {photo ? "Change photo" : "Upload photo"}
                </label>
                {photo && (
                  <button
                    type="button"
                    onClick={() => setPhoto(null)}
                    className="text-sm text-slate-400 hover:text-red-500"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Text fields */}
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
            <label key={label} className="text-sm font-medium text-brand-text">
              {label}
              <input
                className="mt-2 h-11 w-full rounded-md border border-brand-line px-3"
                placeholder={label}
                value={form[key as keyof typeof form]}
                onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
              />
            </label>
          ))}

          <label className="text-sm font-medium text-brand-text">
            Vehicle type
            <select
              className="mt-2 h-11 w-full rounded-md border border-brand-line px-3"
              value={form.type}
              onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
            >
              {vehicleTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-brand-text">
            Primary service area
            <input
              className="mt-2 h-11 w-full rounded-md border border-brand-line px-3"
              value={hasServiceArea ? serviceArea.label : "Set in Company Details"}
              disabled
            />
          </label>

          <label className="text-sm font-medium text-brand-text">
            Planned install date
            <input
              className="mt-2 h-11 w-full rounded-md border border-brand-line px-3"
              type="date"
              value={form.installDate}
              onChange={(event) => setForm((current) => ({ ...current, installDate: event.target.value }))}
            />
          </label>

          <label className="md:col-span-2 text-sm font-medium text-brand-text">
            Notes
            <textarea
              rows={4}
              className="mt-2 w-full rounded-md border border-brand-line px-3 py-3"
              placeholder="Install notes, mounting details, parking habits, future service items..."
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </label>

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

        <div className="flex justify-end gap-3 border-t border-brand-line px-6 py-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!canSubmit} onClick={handleSubmit}>
            Create Vehicle
          </Button>
        </div>
        {!canSubmit && (
          <p className="px-6 pb-5 text-sm text-slate-500">Enter a vehicle name to create the record.</p>
        )}
      </div>
    </div>
  );
}
