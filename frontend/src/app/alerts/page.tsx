"use client";

import dynamic from "next/dynamic";
import { BellRing, AlertTriangle, Download, MapPin, Zap, Gauge } from "lucide-react";
import { ReactNode, useMemo } from "react";

import { SectionCard } from "@/components/ui/SectionCard";
import { formatDate, formatTime, kphToMph, useAllAlerts, type FleetAlert } from "@/lib/fleetHistory";
import { useWorkspace } from "@/lib/workspace";

const AlertMapClient = dynamic(
  () => import("@/components/map/AlertMapClient"),
  { ssr: false, loading: () => <div className="h-72 animate-pulse rounded-lg bg-brand-cloud" /> },
);

const TYPE_META: Record<string, { label: string; icon: ReactNode; color: string }> = {
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
        {alert.speed_kph > 0 ? `${Math.round(kphToMph(alert.speed_kph))} mph` : "—"}
      </td>
      <td className="px-5 py-3 text-sm text-slate-400">
        {alert.lat != null ? `${alert.lat.toFixed(4)}, ${alert.lon?.toFixed(4)}` : "—"}
      </td>
    </tr>
  );
}

export default function AlertsPage() {
  const { state } = useWorkspace();
  const deviceIds = useMemo(
    () =>
      state.vehicles
        .map((v) => v.deviceAssignment)
        .filter((id): id is string => Boolean(id) && id !== "Not assigned"),
    [state.vehicles],
  );
  const { alerts, loading, error } = useAllAlerts(deviceIds);

  const counts = alerts.reduce(
    (acc, a) => {
      acc[a.type] = (acc[a.type] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  function exportCsv() {
    const rows = [
      ["Type", "Detail", "Date", "Time", "Speed (mph)", "Lat", "Lon"].join(","),
      ...alerts.map((a) => [
        TYPE_META[a.type]?.label ?? a.type,
        `"${a.title}"`,
        formatDate(a.time),
        formatTime(a.time),
        a.speed_kph > 0 ? Math.round(kphToMph(a.speed_kph)) : "",
        a.lat ?? "",
        a.lon ?? "",
      ].join(",")),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const el = document.createElement("a");
    el.href = URL.createObjectURL(blob);
    el.download = `alerts-${new Date().toISOString().slice(0, 10)}.csv`;
    el.click();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase text-brand-forest">Alerts</p>
          <h1 className="mt-1 text-3xl font-bold text-brand-ink">Alerts</h1>
          <p className="mt-2 text-sm text-slate-500">
            Driving events across all vehicles — hard braking, rapid acceleration, and speeding.
          </p>
        </div>
        {alerts.length > 0 && (
          <button
            onClick={exportCsv}
            className="mt-1 flex shrink-0 items-center gap-1.5 rounded-lg border border-brand-line bg-white px-3 py-2 text-sm font-medium text-brand-ink transition hover:bg-brand-cloud"
          >
            <Download size={14} />
            Export CSV
          </button>
        )}
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

      {!loading && !error && deviceIds.length === 0 && (
        <SectionCard className="p-8 text-center">
          <BellRing size={22} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-semibold text-brand-ink">No trackers assigned</p>
          <p className="mt-1 text-sm text-slate-500">
            Go to Devices and assign a tracker to a vehicle to start recording events.
          </p>
        </SectionCard>
      )}

      {!loading && !error && deviceIds.length > 0 && alerts.length === 0 && (
        <SectionCard className="p-8 text-center">
          <BellRing size={22} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-semibold text-brand-ink">No alerts recorded</p>
          <p className="mt-1 text-sm text-slate-500">
            Hard braking, rapid acceleration, and speeding events appear here automatically.
          </p>
        </SectionCard>
      )}

      {!loading && alerts.some((a) => a.lat != null && a.lon != null) && (
        <SectionCard className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-brand-line px-5 py-3">
            <MapPin size={16} className="text-brand-navy" />
            <h3 className="text-base font-semibold text-brand-ink">Event map</h3>
            <span className="ml-auto text-xs text-slate-400">
              {alerts.filter((a) => a.lat != null).length} events with location
            </span>
          </div>
          <div className="h-72">
            <AlertMapClient alerts={alerts} />
          </div>
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
