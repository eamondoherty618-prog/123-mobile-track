"use client";

import { Mail, SlidersHorizontal, Trash2, UserPlus, Users } from "lucide-react";
import { useState } from "react";

import { SetupWorkspaceModal } from "@/components/forms/SetupWorkspaceModal";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { serviceAreaOptions, useWorkspace } from "@/lib/workspace";

const ALERT_TYPES = [
  { id: "hard_brake", label: "Hard brake" },
  { id: "rapid_accel", label: "Rapid accel" },
  { id: "speeding", label: "Speeding" },
  { id: "gps_offline", label: "GPS offline" },
];

type Tab = "company" | "admins" | "tracking";

function DataEstimate({
  movingS,
  stoppedS,
}: {
  movingS: number;
  stoppedS: number;
}) {
  const bytesPerPacket = 220;
  const movingPacketsPerDay = Math.floor((4 * 3600) / Math.max(movingS, 1));
  const stoppedPacketsPerDay = Math.floor((20 * 3600) / Math.max(stoppedS, 1));
  const totalMB = ((movingPacketsPerDay + stoppedPacketsPerDay) * bytesPerPacket) / 1_000_000;
  return (
    <p className="text-xs text-slate-500">
      Estimated data: ~{totalMB.toFixed(1)} MB/day per tracker (assumes 4 h driving, 20 h parked).
      {movingS < 10 && (
        <span className="ml-1 font-medium text-amber-600">
          Short moving intervals use significantly more data.
        </span>
      )}
    </p>
  );
}

export default function SettingsPage() {
  const {
    state,
    serviceArea,
    hasServiceArea,
    addAdmin,
    removeAdmin,
    updateAdminAlerts,
    updateTrackingProfile,
    completeSetup,
  } = useWorkspace();

  const [activeTab, setActiveTab] = useState<Tab>("company");
  const [companyOpen, setCompanyOpen] = useState(false);

  // Inline service area selector state
  const [editingServiceArea, setEditingServiceArea] = useState(false);

  // Add admin form
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminAlerts, setNewAdminAlerts] = useState<string[]>([
    "hard_brake",
    "rapid_accel",
    "speeding",
  ]);

  // Tracking profile local edit state
  const profile = state.trackingProfile;
  const [trackingEdit, setTrackingEdit] = useState({
    movingIntervalS: profile?.movingIntervalS ?? 10,
    stoppedIntervalS: profile?.stoppedIntervalS ?? 60,
    idleTimeoutMin: profile?.idleTimeoutMin ?? 5,
    deepSleepTimeoutMin: profile?.deepSleepTimeoutMin ?? 15,
    heartbeatIntervalMin: profile?.heartbeatIntervalMin ?? 30,
  });
  const [trackingSaved, setTrackingSaved] = useState(false);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "company", label: "Company", icon: <SlidersHorizontal size={15} /> },
    { id: "admins", label: "Admins", icon: <Users size={15} /> },
    { id: "tracking", label: "Tracking", icon: <Mail size={15} /> },
  ];

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase text-brand-forest">Settings</p>
        <h1 className="mt-1 text-3xl font-bold text-brand-ink">Settings</h1>
        <p className="mt-2 text-sm text-slate-500">
          Company details, admin access, and default tracking behavior for this account.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-brand-line bg-brand-cloud p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-white text-brand-ink shadow-sm"
                : "text-slate-500 hover:text-brand-ink"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Company tab */}
      {activeTab === "company" && (
        <div className="grid gap-5 xl:grid-cols-2">
          <SectionCard className="p-5">
            <h2 className="text-base font-semibold text-brand-ink">Company</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-md border border-brand-line px-4 py-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Company name</p>
                <p className="mt-1 font-semibold text-brand-ink">{state.companyName}</p>
              </div>

              <div className="rounded-md border border-brand-line px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">Service area</p>
                    {editingServiceArea ? (
                      <select
                        className="mt-2 h-9 rounded-md border border-brand-line px-2 text-sm"
                        value={state.serviceAreaId}
                        onChange={(e) => {
                          completeSetup({
                            companyName: state.companyName,
                            serviceAreaId: e.target.value,
                            timezone: state.timezone,
                            adminName: state.adminName,
                            adminEmail: state.adminEmail,
                          });
                          setEditingServiceArea(false);
                        }}
                        autoFocus
                      >
                        <option value="">No service area</option>
                        {serviceAreaOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="mt-1 font-semibold text-brand-ink">
                        {hasServiceArea ? serviceArea.label : "Not set"}
                      </p>
                    )}
                  </div>
                  {!editingServiceArea && (
                    <button
                      onClick={() => setEditingServiceArea(true)}
                      className="shrink-0 rounded-md border border-brand-line px-3 py-1.5 text-xs font-medium hover:bg-brand-cloud"
                    >
                      {hasServiceArea ? "Change" : "Set area"}
                    </button>
                  )}
                  {editingServiceArea && (
                    <button
                      onClick={() => setEditingServiceArea(false)}
                      className="shrink-0 text-xs text-slate-400 hover:text-brand-ink"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              <div className="rounded-md border border-brand-line px-4 py-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Primary contact</p>
                <p className="mt-1 font-semibold text-brand-ink">{state.adminName}</p>
                <p className="text-slate-500">{state.adminEmail}</p>
              </div>

              <div className="rounded-md border border-brand-line px-4 py-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Timezone</p>
                <p className="mt-1 font-semibold text-brand-ink">{state.timezone}</p>
              </div>
            </div>
            <Button className="mt-4" variant="secondary" onClick={() => setCompanyOpen(true)}>
              <SlidersHorizontal size={15} className="mr-2" />
              Edit Company Details
            </Button>
          </SectionCard>

          <SectionCard className="p-5">
            <h2 className="text-base font-semibold text-brand-ink">Account</h2>
            <p className="mt-2 text-sm text-slate-500">
              This account manages the 123 Mobile Track fleet. Data is stored locally on this
              device and synced via the fleet server.
            </p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="rounded-md border border-brand-line px-4 py-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Fleet server</p>
                <p className="mt-1 font-semibold text-brand-ink">fleet.vintagemotoct.com</p>
                <p className="text-xs text-slate-500">Cloudflare tunnel · Windows host</p>
              </div>
              <div className="rounded-md border border-brand-line px-4 py-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Hardware</p>
                <p className="mt-1 font-semibold text-brand-ink">LilyGo T-SIM7000G</p>
                <p className="text-xs text-slate-500">ESP32 · SIM7000G modem · 1NCE SIM</p>
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {/* Admins tab */}
      {activeTab === "admins" && (
        <div className="grid gap-5 xl:grid-cols-2">
          <SectionCard className="overflow-hidden">
            <div className="border-b border-brand-line px-5 py-4">
              <h2 className="text-base font-semibold text-brand-ink">Team members</h2>
              <p className="text-sm text-slate-500">
                Each admin receives alert emails for the types they have enabled.
              </p>
            </div>
            <div className="divide-y divide-brand-line">
              {state.admins.map((admin) => (
                <div key={admin.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-brand-ink">
                        {admin.name}
                        {admin.isPrimary && (
                          <span className="ml-2 rounded-full bg-brand-mint px-2 py-0.5 text-xs font-medium text-brand-forest">
                            Primary
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-slate-500">{admin.email}</p>
                    </div>
                    {!admin.isPrimary && (
                      <button
                        onClick={() => removeAdmin(admin.id)}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                        title="Remove admin"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ALERT_TYPES.map((type) => {
                      const enabled = admin.alertTypes.includes(type.id);
                      return (
                        <button
                          key={type.id}
                          onClick={() => {
                            const next = enabled
                              ? admin.alertTypes.filter((t) => t !== type.id)
                              : [...admin.alertTypes, type.id];
                            updateAdminAlerts(admin.id, next);
                          }}
                          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                            enabled
                              ? "border-brand-forest bg-brand-mint text-brand-forest"
                              : "border-brand-line bg-white text-slate-400"
                          }`}
                        >
                          {type.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard className="p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-brand-mint p-3 text-brand-forest">
                <UserPlus size={18} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-brand-ink">Add admin</h2>
                <p className="text-sm text-slate-500">
                  They will receive alert emails for the types you select.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <label className="block text-sm font-medium text-brand-text">
                Name
                <input
                  className="mt-2 h-10 w-full rounded-md border border-brand-line px-3 text-sm"
                  placeholder="Name (optional)"
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                />
              </label>
              <label className="block text-sm font-medium text-brand-text">
                Email address
                <input
                  className="mt-2 h-10 w-full rounded-md border border-brand-line px-3 text-sm"
                  type="email"
                  placeholder="admin@example.com"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                />
              </label>

              <div>
                <p className="text-sm font-medium text-brand-text">Alert types</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ALERT_TYPES.map((type) => {
                    const enabled = newAdminAlerts.includes(type.id);
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() =>
                          setNewAdminAlerts((prev) =>
                            enabled ? prev.filter((t) => t !== type.id) : [...prev, type.id],
                          )
                        }
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                          enabled
                            ? "border-brand-forest bg-brand-mint text-brand-forest"
                            : "border-brand-line bg-white text-slate-400"
                        }`}
                      >
                        {type.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button
                disabled={!newAdminEmail.includes("@")}
                onClick={() => {
                  addAdmin({
                    name: newAdminName || newAdminEmail,
                    email: newAdminEmail,
                    alertTypes: newAdminAlerts,
                  });
                  setNewAdminEmail("");
                  setNewAdminName("");
                  setNewAdminAlerts(["hard_brake", "rapid_accel", "speeding"]);
                }}
              >
                <UserPlus size={15} className="mr-2" />
                Add admin
              </Button>

              <p className="text-xs text-slate-400">
                Email delivery is in development — admin records are saved to this account now.
              </p>
            </div>
          </SectionCard>
        </div>
      )}

      {/* Tracking tab */}
      {activeTab === "tracking" && (
        <div className="grid gap-5 xl:grid-cols-2">
          <SectionCard className="p-5">
            <h2 className="text-base font-semibold text-brand-ink">Default tracking behavior</h2>
            <p className="mt-1 text-sm text-slate-500">
              These values reflect the firmware build settings. Remote configuration push is in development.
            </p>

            <div className="mt-5 space-y-3">
              {(
                [
                  ["Moving update interval", "movingIntervalS", "seconds", 5, 300],
                  ["Stopped update interval", "stoppedIntervalS", "seconds", 10, 600],
                  ["Idle timeout", "idleTimeoutMin", "minutes", 1, 60],
                  ["Deep sleep timeout", "deepSleepTimeoutMin", "minutes", 1, 120],
                  ["Heartbeat while asleep", "heartbeatIntervalMin", "minutes", 5, 120],
                ] as [string, keyof typeof trackingEdit, string, number, number][]
              ).map(([label, key, unit, min, max]) => (
                <label key={key} className="block text-sm font-medium text-brand-text">
                  {label}
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min={min}
                      max={max}
                      className="h-10 w-24 rounded-md border border-brand-line px-3 text-sm"
                      value={trackingEdit[key]}
                      onChange={(e) => {
                        setTrackingEdit((prev) => ({ ...prev, [key]: Number(e.target.value) }));
                        setTrackingSaved(false);
                      }}
                    />
                    <span className="text-sm text-slate-500">{unit}</span>
                  </div>
                </label>
              ))}

              <DataEstimate
                movingS={trackingEdit.movingIntervalS}
                stoppedS={trackingEdit.stoppedIntervalS}
              />

              <Button
                onClick={() => {
                  updateTrackingProfile(trackingEdit);
                  setTrackingSaved(true);
                }}
              >
                Save changes
              </Button>
              {trackingSaved && (
                <p className="text-sm text-brand-forest">Settings saved to account.</p>
              )}
            </div>
          </SectionCard>

          <SectionCard className="p-5">
            <h2 className="text-base font-semibold text-brand-ink">Firmware build settings</h2>
            <p className="mt-2 text-sm text-slate-500">
              The current trackers have these intervals compiled into firmware.
              When remote configuration is available, changes saved above will push automatically.
            </p>
            <div className="mt-4 space-y-2 text-sm">
              {[
                ["Moving interval", "10 seconds (TRACKER_MOVING_INTERVAL_MS)"],
                ["Stopped interval", "60 seconds (TRACKER_PARKED_INTERVAL_MS)"],
                ["Min moving speed", "6 km/h (TRACKER_MIN_MOVING_SPEED_KPH)"],
                ["GNSS recycle", "20 min (TRACKER_GNSS_RECYCLE_MS)"],
                ["GNSS warmup", "45 s (TRACKER_GNSS_WARMUP_MS)"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-brand-line px-4 py-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
                  <p className="mt-1 font-mono text-sm text-brand-ink">{value}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      <SetupWorkspaceModal open={companyOpen} onClose={() => setCompanyOpen(false)} />
    </div>
  );
}
