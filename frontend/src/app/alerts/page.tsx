"use client";

import { BellRing, AlertTriangle, Zap, Gauge } from "lucide-react";

import { SectionCard } from "@/components/ui/SectionCard";
import { formatDate, formatTime, useAlerts, type FleetAlert } from "@/lib/fleetHistory";

const TYPE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  hard_brake: {
    label: "Hard brake",
    icon: <AlertTriangle size={14} />,
    color: "bg-red-100 text-red-700 border-red-200",
  },
  rapid_accel: {
    label: "Rapid accel",
    icon: <Zap size={14} />,
    color: "bg-amber-100 text-amber-700 border-amber-200",
  },
  speeding: {
    label: "Speeding",
    icon: <Gauge size={14} />,
    color: "bg-orange-100 text-orange-700 border-orange-200",
  },
};

function AlertRow({ alert }: { alert: FleetAlert }) {
  const meta = TYPE_META[alert.type] ?? {
    label: alert.type,
    icon: <BellRing size={14} />,
    color: "bg-slate-100 text-slate-600 border-slate-200",
  };

  return (
    <tr className="border-t border-brand-line">
      <td className="px-5 py-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.color}`}>
          {meta.icon}
          {meta.label}
        </span>
      </td>
      <td className="px-5 py-3 text-sm text-brand-ink font-medium">
        {alert.title}
      </td>
      <td className="px-5 py-3 text-sm text-slate-500">
        {formatDate(alert.time)}
      </td>
      <td className="px-5 py-3 text-sm text-slate-500">
        {formatTime(alert.time)}
      </td>
      <td className="px-5 py-3 text-sm text-slate-500">
        {alert.speed_kph > 0 ? `${alert.speed_kph} kph` : "—"}
      </td>
      <td className="px-5 py-3 text-sm text-slate-400">
        {alert.lat != null ? `${alert.lat.toFixed(4)}, ${alert.lon?.toFixed(4)}` : "—"}
      </td>
    </tr>
  );
}

export default function AlertsPage() {
  const { alerts, loading, error } = useAlerts("tracker-001");

  const counts = alerts.reduce(
    (acc, a) => {
      acc[a.type] = (acc[a.type] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase text-brand-forest">Alerts</p>
        <h1 className="mt-1 text-3xl font-bold text-brand-ink">Alerts</h1>
        <p className="mt-2 text-sm text-slate-500">
          Driving events detected by tracker-001 — hard braking, rapid acceleration, and speeding.
        </p>
      </div>

      {!loading && !error && alerts.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {(["hard_brake", "rapid_accel", "speeding"] as const).map((type) => (
            <SectionCard key={type} className="p-4">
              <p className="text-xs text-slate-400 uppercase font-semibold">{TYPE_META[type].label}</p>
              <p className="mt-1 text-2xl font-bold text-brand-ink">{counts[type] ?? 0}</p>
            </SectionCard>
          ))}
        </div>
      )}

      {loading && (
        <SectionCard className="p-8 text-center text-sm text-slate-400">Loading alerts…</SectionCard>
      )}

      {error && (
        <SectionCard className="p-5 text-sm text-red-600">
          Could not load alerts: {error}
        </SectionCard>
      )}

      {!loading && !error && alerts.length === 0 && (
        <SectionCard className="p-8 text-center">
          <BellRing size={22} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-semibold text-brand-ink">No alerts recorded</p>
          <p className="mt-1 text-sm text-slate-500">
            Hard braking, rapid acceleration, and speeding events appear here automatically.
          </p>
        </SectionCard>
      )}

      {!loading && alerts.length > 0 && (
        <SectionCard className="overflow-hidden">
          <div className="border-b border-brand-line px-5 py-4">
            <h3 className="text-base font-semibold text-brand-ink">Event log</h3>
            <p className="text-sm text-slate-500">{alerts.length} event{alerts.length !== 1 ? "s" : ""} — most recent first</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-brand-cloud text-slate-500">
                <tr>
                  {["Type", "Detail", "Date", "Time", "Speed", "Location"].map((h) => (
                    <th key={h} className="px-5 py-3 font-semibold text-xs uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {alerts.map((a) => <AlertRow key={a.id} alert={a} />)}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
