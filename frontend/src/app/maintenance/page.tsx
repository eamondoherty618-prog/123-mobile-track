"use client";

import {
  AlertTriangle,
  BatteryWarning,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Gauge,
  Plus,
  Settings2,
  Trash2,
  Wind,
  Wrench,
} from "lucide-react";
import { ElementType, useState } from "react";

import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { useTripMilesSince } from "@/lib/fleetHistory";
import { useWorkspace } from "@/lib/workspace";
import { MaintenanceItem, MaintenanceType, Vehicle } from "@/types";

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_META: Record<
  MaintenanceType,
  { label: string; icon: ElementType; intervalMiles: number; intervalMonths: number }
> = {
  oil_change:    { label: "Oil Change",       icon: Gauge,          intervalMiles: 3000,  intervalMonths: 6  },
  tire_rotation: { label: "Tire Rotation",    icon: Settings2,      intervalMiles: 5000,  intervalMonths: 6  },
  brakes:        { label: "Brake Inspection", icon: AlertTriangle,  intervalMiles: 12000, intervalMonths: 12 },
  air_filter:    { label: "Air Filter",       icon: Wind,           intervalMiles: 15000, intervalMonths: 12 },
  battery:       { label: "Battery Check",    icon: BatteryWarning, intervalMiles: 0,     intervalMonths: 24 },
  custom:        { label: "Custom",           icon: Wrench,         intervalMiles: 5000,  intervalMonths: 6  },
};

// ─── Due status helpers ────────────────────────────────────────────────────────

type DueStatus = "ok" | "due_soon" | "overdue";

function getDueStatus(
  item: MaintenanceItem,
  milesDriven: number,
  milesLoading: boolean,
): { status: DueStatus; milesInfo: string; timeInfo: string; progressPct: number } {
  const monthsSince =
    (Date.now() - new Date(item.lastServiceDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44);

  let timePct = 0;
  let timeInfo = "";
  if (item.intervalMonths > 0) {
    timePct = monthsSince / item.intervalMonths;
    const rem = item.intervalMonths - monthsSince;
    timeInfo =
      rem <= 0
        ? `${Math.floor(monthsSince - item.intervalMonths)} mo overdue`
        : `~${Math.ceil(rem)} mo${Math.ceil(rem) !== 1 ? "s" : ""} left`;
  }

  let milesPct = 0;
  let milesInfo = "";
  if (item.intervalMiles > 0) {
    if (milesLoading) {
      milesInfo = "Loading GPS miles…";
    } else {
      milesPct = milesDriven / item.intervalMiles;
      const rem = item.intervalMiles - milesDriven;
      milesInfo =
        rem <= 0
          ? `${Math.abs(rem).toLocaleString()} mi overdue`
          : `${rem.toLocaleString()} mi to go (${milesDriven.toLocaleString()} / ${item.intervalMiles.toLocaleString()})`;
    }
  }

  const pct = Math.max(milesPct, timePct);
  const status: DueStatus = pct >= 1.0 ? "overdue" : pct >= 0.85 ? "due_soon" : "ok";

  return { status, milesInfo, timeInfo, progressPct: Math.min(pct * 100, 100) };
}

// ─── Item row ─────────────────────────────────────────────────────────────────

function ItemRow({
  item,
  deviceId,
  onEdit,
  onDelete,
  onToggleAlert,
}: {
  item: MaintenanceItem;
  deviceId: string | undefined;
  onEdit: () => void;
  onDelete: () => void;
  onToggleAlert: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { miles, loading } = useTripMilesSince(deviceId, item.lastServiceDate);
  const { status, milesInfo, timeInfo, progressPct } = getDueStatus(item, miles, loading);
  const Icon = TYPE_META[item.type].icon;

  const colors = {
    ok:       { bar: "bg-green-500", badge: "bg-green-100 text-green-700",  icon: "bg-green-50 text-green-600",  label: "On schedule" },
    due_soon: { bar: "bg-amber-400", badge: "bg-amber-100 text-amber-700",  icon: "bg-amber-50 text-amber-500",  label: "Due soon"    },
    overdue:  { bar: "bg-red-500",   badge: "bg-red-100 text-red-700",      icon: "bg-red-50 text-red-500",      label: "Overdue"     },
  }[status];

  return (
    <div className="rounded-xl border border-brand-line bg-white p-4">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${colors.icon}`}>
          <Icon size={17} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-brand-ink">{item.label}</p>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${colors.badge}`}>
              {colors.label}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Last service: {new Date(item.lastServiceDate).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
          </p>

          <div className="mt-2.5 space-y-1.5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full transition-all ${colors.bar}`} style={{ width: `${progressPct}%` }} />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5">
              {milesInfo && (
                <span className="flex items-center gap-1 text-xs text-slate-500"><Gauge size={11} />{milesInfo}</span>
              )}
              {timeInfo && (
                <span className="flex items-center gap-1 text-xs text-slate-500"><Clock size={11} />{timeInfo}</span>
              )}
            </div>
          </div>

          {item.notes && <p className="mt-2 text-xs italic text-slate-500">{item.notes}</p>}
        </div>

        <div className="flex shrink-0 flex-col items-center gap-1.5">
          <button
            onClick={onToggleAlert}
            title={item.alertEnabled ? "Alerts on" : "Alerts off"}
            className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
              item.alertEnabled ? "bg-brand-forest/10 text-brand-forest hover:bg-brand-forest/20" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
            }`}
          >
            {item.alertEnabled ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          </button>
          <button onClick={onEdit} className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-500 transition hover:bg-slate-200">
            <Wrench size={13} />
          </button>
          {confirmDelete ? (
            <div className="flex flex-col gap-1">
              <button onClick={onDelete} className="rounded px-1.5 py-0.5 text-xs font-semibold bg-red-100 text-red-600 hover:bg-red-200">Del</button>
              <button onClick={() => setConfirmDelete(false)} className="rounded px-1.5 py-0.5 text-xs text-slate-400 hover:text-slate-600">No</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="flex h-7 w-7 items-center justify-center rounded-md bg-red-50 text-red-400 transition hover:bg-red-100">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Add / Edit form ──────────────────────────────────────────────────────────

type FormData = Omit<MaintenanceItem, "id" | "vehicleId">;

const BLANK: FormData = {
  type: "oil_change",
  label: TYPE_META.oil_change.label,
  lastServiceDate: new Date().toISOString().slice(0, 10),
  intervalMiles: 3000,
  intervalMonths: 6,
  notes: "",
  alertEnabled: true,
};

function ItemForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<FormData>;
  onSave: (d: FormData) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState<FormData>({ ...BLANK, ...initial });

  function applyType(type: MaintenanceType) {
    const m = TYPE_META[type];
    setF((prev) => ({
      ...prev,
      type,
      label: type !== "custom" ? m.label : prev.label,
      intervalMiles: m.intervalMiles,
      intervalMonths: m.intervalMonths,
    }));
  }

  return (
    <div className="rounded-xl border border-brand-forest/30 bg-brand-cloud/60 p-4 space-y-3">
      <p className="text-sm font-semibold text-brand-ink">{initial ? "Edit item" : "New maintenance item"}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Service type</label>
          <select
            value={f.type}
            onChange={(e) => applyType(e.target.value as MaintenanceType)}
            className="h-10 w-full rounded-lg border border-brand-line bg-white px-3 text-sm"
          >
            {(Object.keys(TYPE_META) as MaintenanceType[]).map((t) => (
              <option key={t} value={t}>{TYPE_META[t].label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Label</label>
          <input
            value={f.label}
            onChange={(e) => setF((p) => ({ ...p, label: e.target.value }))}
            className="h-10 w-full rounded-lg border border-brand-line bg-white px-3 text-sm"
            placeholder="e.g. Oil Change"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Last service date</label>
          <input
            type="date"
            value={f.lastServiceDate}
            onChange={(e) => setF((p) => ({ ...p, lastServiceDate: e.target.value }))}
            className="h-10 w-full rounded-lg border border-brand-line bg-white px-3 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Miles interval <span className="text-slate-400">(0 = off)</span></label>
          <div className="flex gap-1.5">
            <input
              type="number" min={0} value={f.intervalMiles}
              onChange={(e) => setF((p) => ({ ...p, intervalMiles: Number(e.target.value) }))}
              className="h-10 w-20 rounded-lg border border-brand-line bg-white px-3 text-sm"
            />
            {[3000, 5000, 7500, 10000].map((v) => (
              <button key={v} type="button" onClick={() => setF((p) => ({ ...p, intervalMiles: v }))}
                className={`h-10 rounded-lg border px-2 text-xs font-medium transition ${f.intervalMiles === v ? "border-brand-forest bg-brand-forest text-white" : "border-brand-line bg-white text-slate-600 hover:bg-brand-cloud"}`}>
                {v >= 1000 ? `${v / 1000}k` : v}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Month interval <span className="text-slate-400">(0 = off)</span></label>
          <div className="flex gap-1.5">
            <input
              type="number" min={0} value={f.intervalMonths}
              onChange={(e) => setF((p) => ({ ...p, intervalMonths: Number(e.target.value) }))}
              className="h-10 w-16 rounded-lg border border-brand-line bg-white px-3 text-sm"
            />
            {[3, 6, 12, 24].map((v) => (
              <button key={v} type="button" onClick={() => setF((p) => ({ ...p, intervalMonths: v }))}
                className={`h-10 rounded-lg border px-2.5 text-xs font-medium transition ${f.intervalMonths === v ? "border-brand-forest bg-brand-forest text-white" : "border-brand-line bg-white text-slate-600 hover:bg-brand-cloud"}`}>
                {v}mo
              </button>
            ))}
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-500">Notes</label>
          <input
            value={f.notes}
            onChange={(e) => setF((p) => ({ ...p, notes: e.target.value }))}
            className="h-10 w-full rounded-lg border border-brand-line bg-white px-3 text-sm"
            placeholder="Synthetic 5W-30, check engine light code, etc."
          />
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2.5">
        <div
          onClick={() => setF((p) => ({ ...p, alertEnabled: !p.alertEnabled }))}
          className={`relative h-5 w-9 rounded-full transition-colors ${f.alertEnabled ? "bg-brand-forest" : "bg-slate-300"}`}
        >
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${f.alertEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
        </div>
        <span className="text-sm text-brand-ink">
          {f.alertEnabled ? "Alert when due" : "No alerts"}
        </span>
      </label>

      <div className="flex gap-2 pt-1">
        <Button onClick={() => onSave(f)} className="h-9 px-4 text-sm">Save</Button>
        <Button variant="secondary" onClick={onCancel} className="h-9 px-4 text-sm">Cancel</Button>
      </div>
    </div>
  );
}

// ─── Vehicle section ──────────────────────────────────────────────────────────

function VehicleSection({
  vehicle,
  items,
  onAdd,
  onUpdate,
  onRemove,
}: {
  vehicle: Vehicle;
  items: MaintenanceItem[];
  onAdd: (d: Omit<MaintenanceItem, "id">) => void;
  onUpdate: (id: string, updates: Partial<Omit<MaintenanceItem, "id">>) => void;
  onRemove: (id: string) => void;
}) {
  const deviceId =
    vehicle.deviceAssignment && vehicle.deviceAssignment !== "Not assigned"
      ? vehicle.deviceAssignment
      : undefined;

  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const dueCount = items.filter((it) => {
    if (!it.intervalMonths) return false;
    const mo = (Date.now() - new Date(it.lastServiceDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    return mo >= it.intervalMonths * 0.85;
  }).length;

  return (
    <SectionCard className="overflow-hidden">
      <button
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-brand-line bg-brand-cloud flex items-center justify-center">
          {vehicle.photo
            ? <img src={vehicle.photo} alt={vehicle.name} className="h-full w-full object-cover" />
            : <Wrench size={16} className="text-brand-navy" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-brand-ink">{vehicle.name}</p>
          <p className="text-xs text-slate-500">
            {vehicle.type}
            {deviceId ? ` · ${deviceId}` : " · No tracker assigned"}
            {items.length > 0 ? ` · ${items.length} item${items.length !== 1 ? "s" : ""}` : ""}
          </p>
        </div>
        {dueCount > 0 && (
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
            {dueCount} due
          </span>
        )}
        {open ? <ChevronUp size={16} className="shrink-0 text-slate-400" /> : <ChevronDown size={16} className="shrink-0 text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-brand-line space-y-3 px-5 pb-5 pt-4">
          {items.length === 0 && !adding && (
            <p className="text-sm text-slate-400">No service records yet.</p>
          )}

          {items.map((item) =>
            editId === item.id ? (
              <ItemForm
                key={item.id}
                initial={{ type: item.type, label: item.label, lastServiceDate: item.lastServiceDate, intervalMiles: item.intervalMiles, intervalMonths: item.intervalMonths, notes: item.notes, alertEnabled: item.alertEnabled }}
                onSave={(d) => { onUpdate(item.id, d); setEditId(null); }}
                onCancel={() => setEditId(null)}
              />
            ) : (
              <ItemRow
                key={item.id}
                item={item}
                deviceId={deviceId}
                onEdit={() => setEditId(item.id)}
                onDelete={() => onRemove(item.id)}
                onToggleAlert={() => onUpdate(item.id, { alertEnabled: !item.alertEnabled })}
              />
            )
          )}

          {adding ? (
            <ItemForm
              onSave={(d) => { onAdd({ ...d, vehicleId: vehicle.id }); setAdding(false); }}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-3 text-sm font-medium text-brand-navy transition hover:border-brand-navy hover:bg-brand-cloud/50"
            >
              <Plus size={15} />
              Add maintenance item
            </button>
          )}
        </div>
      )}
    </SectionCard>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MaintenancePage() {
  const { state, addMaintenanceItem, updateMaintenanceItem, removeMaintenanceItem } = useWorkspace();

  const dueCount = state.maintenanceItems.filter((it) => {
    if (!it.intervalMonths) return false;
    const mo = (Date.now() - new Date(it.lastServiceDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    return mo >= it.intervalMonths * 0.85;
  }).length;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase text-brand-forest">Maintenance</p>
        <h1 className="mt-1 text-2xl font-bold text-brand-ink sm:text-3xl">Vehicle Maintenance</h1>
        <p className="mt-2 text-sm text-slate-500">
          Service intervals tracked per vehicle. Miles driven pulled automatically from GPS trips.
        </p>
      </div>

      {state.maintenanceItems.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <SectionCard className="px-4 py-3">
            <p className="text-xs text-slate-500">Total items</p>
            <p className="mt-0.5 text-xl font-bold text-brand-ink">{state.maintenanceItems.length}</p>
          </SectionCard>
          <SectionCard className="px-4 py-3">
            <p className="text-xs text-slate-500">Due / due soon</p>
            <p className={`mt-0.5 text-xl font-bold ${dueCount > 0 ? "text-amber-600" : "text-brand-ink"}`}>{dueCount}</p>
          </SectionCard>
          <SectionCard className="px-4 py-3">
            <p className="text-xs text-slate-500">Vehicles</p>
            <p className="mt-0.5 text-xl font-bold text-brand-ink">
              {new Set(state.maintenanceItems.map((m) => m.vehicleId)).size}
            </p>
          </SectionCard>
        </div>
      )}

      {state.vehicles.length === 0 ? (
        <SectionCard className="flex flex-col items-center py-16 text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-cloud">
            <Wrench size={26} className="text-brand-navy" />
          </div>
          <p className="text-base font-semibold text-brand-ink">No vehicles yet</p>
          <p className="mt-1 max-w-xs text-sm text-slate-500">
            Add a vehicle first, then track service history here.
          </p>
        </SectionCard>
      ) : (
        <div className="space-y-4">
          {state.vehicles.map((vehicle) => (
            <VehicleSection
              key={vehicle.id}
              vehicle={vehicle}
              items={state.maintenanceItems.filter((m) => m.vehicleId === vehicle.id)}
              onAdd={addMaintenanceItem}
              onUpdate={updateMaintenanceItem}
              onRemove={removeMaintenanceItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}
