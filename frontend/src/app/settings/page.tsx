"use client";

import { CheckCircle2, Clock, CloudOff, KeyRound, Loader2, LogOut, Mail, MapPin, Pencil, RefreshCw, Search, SlidersHorizontal, Trash2, Upload, UserPlus, Users, Wifi, X } from "lucide-react";
import { ReactNode, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { SetupWorkspaceModal } from "@/components/forms/SetupWorkspaceModal";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { useAuth, getStoredToken } from "@/lib/auth";
import { canManageAdmins } from "@/lib/permissions";
import { serviceAreaOptions, useWorkspace, WifiShortcut } from "@/lib/workspace";

const ALERT_TYPES = [
  { id: "hard_brake", label: "Hard brake" },
  { id: "rapid_accel", label: "Rapid accel" },
  { id: "speeding", label: "Speeding" },
  { id: "gps_offline", label: "GPS offline" },
];

type Tab = "account" | "company" | "admins" | "tracking" | "wifi";

type TeamMember = {
  user_id: string;
  email: string;
  role: string;
  created_at: string;
  full_name: string | null;
  last_sign_in_at: string | null;
};

type TeamInvite = {
  email: string;
  role: string;
  created_at: string;
};

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    owner: "bg-purple-50 border-purple-200 text-purple-700",
    admin: "bg-blue-50 border-blue-200 text-blue-700",
    driver: "bg-brand-mint border-brand-forest/30 text-brand-forest",
  };
  const labels: Record<string, string> = { owner: "Owner", admin: "Admin", driver: "Driver" };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${styles[role] ?? "bg-slate-50 border-slate-200 text-slate-600"}`}>
      {labels[role] ?? role}
    </span>
  );
}

function formatLastLogin(iso: string | null, tz: string): string {
  if (!iso) return "Never logged in";
  const d = new Date(iso);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString("en-US", { timeZone: tz, month: "short", day: "numeric" });
}

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
    serverSynced,
    forceSyncToServer,
    addAdmin,
    removeAdmin,
    updateAdmin,
    updateAdminAlerts,
    updateTrackingProfile,
    updateTimezone,
    completeSetup,
    addWifiShortcut,
    removeWifiShortcut,
    userRole,
  } = useWorkspace();

  const { user, logout, updatePassword } = useAuth();
  const isOwner = canManageAdmins(userRole);
  const router = useRouter();

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  const [activeTab, setActiveTab] = useState<Tab>("account");
  const [companyOpen, setCompanyOpen] = useState(false);

  // Push notification state
  const [pushStatus, setPushStatus] = useState<"unknown" | "granted" | "denied" | "unsupported">("unknown");
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPushStatus("unsupported");
      return;
    }
    if (Notification.permission === "granted") setPushStatus("granted");
    else if (Notification.permission === "denied") setPushStatus("denied");
    else setPushStatus("unknown");
  }, []);

  async function handleEnablePush() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    setPushLoading(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setPushStatus("denied"); return; }
      setPushStatus("granted");

      const reg = await navigator.serviceWorker.ready;
      const keyRes = await fetch("/api/push?vapidPublicKey=1");
      const { publicKey } = await keyRes.json() as { publicKey: string };

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const { getStoredToken } = await import("@/lib/auth");
      const token = getStoredToken();
      await fetch("/api/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: "subscribe", subscription: sub.toJSON() }),
      });
    } catch (e) {
      console.error("Push subscribe error:", e);
    } finally {
      setPushLoading(false);
    }
  }

  async function handleDisablePush() {
    setPushLoading(true);
    try {
      const { getStoredToken } = await import("@/lib/auth");
      const token = getStoredToken();
      await fetch("/api/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: "unsubscribe" }),
      });
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
      }
      setPushStatus("unknown");
    } finally {
      setPushLoading(false);
    }
  }

  function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
  }

  // Inline service area selector state
  const [editingServiceArea, setEditingServiceArea] = useState(false);

  // Edit admin inline state
  const [editingTimezone, setEditingTimezone] = useState(false);
  const [editingAdminId, setEditingAdminId] = useState<string | null>(null);
  const [editAdminName, setEditAdminName] = useState("");
  const [editAdminEmail, setEditAdminEmail] = useState("");
  const [confirmRemoveAdminId, setConfirmRemoveAdminId] = useState<string | null>(null);
  const [confirmRemoveWifiId, setConfirmRemoveWifiId] = useState<string | null>(null);

  // Add admin form
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminAlerts, setNewAdminAlerts] = useState<string[]>([
    "hard_brake",
    "rapid_accel",
    "speeding",
  ]);

  // Team management state
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamInvites, setTeamInvites] = useState<TeamInvite[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "driver">("admin");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmRemoveMemberId, setConfirmRemoveMemberId] = useState<string | null>(null);

  async function loadTeam() {
    setTeamLoading(true);
    try {
      const token = getStoredToken();
      const res = await fetch("/api/team", {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json() as { ok: boolean; members?: TeamMember[]; invites?: TeamInvite[] };
      if (data.ok) {
        setTeamMembers(data.members ?? []);
        setTeamInvites(data.invites ?? []);
      }
    } catch { /* ignore */ } finally {
      setTeamLoading(false);
    }
  }

  async function sendInvite() {
    if (!inviteEmail.includes("@")) return;
    setInviteSending(true);
    setInviteMsg(null);
    try {
      const token = getStoredToken();
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json() as { ok: boolean; error?: string };
      if (data.ok) {
        setInviteMsg({ ok: true, text: `Invite sent to ${inviteEmail}.` });
        setTeamInvites((prev) => [...prev, { email: inviteEmail, role: inviteRole, created_at: new Date().toISOString() }]);
        setInviteEmail("");
      } else {
        setInviteMsg({
          ok: false,
          text: data.error === "already_member" ? "Already a team member." : (data.error ?? "Failed to send invite"),
        });
      }
    } catch {
      setInviteMsg({ ok: false, text: "Network error." });
    } finally {
      setInviteSending(false);
    }
  }

  async function removeMember(memberId: string) {
    const token = getStoredToken();
    await fetch("/api/team", {
      method: "DELETE",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ type: "member", user_id: memberId }),
    });
    setTeamMembers((prev) => prev.filter((m) => m.user_id !== memberId));
    setConfirmRemoveMemberId(null);
  }

  async function cancelInvite(email: string) {
    const token = getStoredToken();
    await fetch("/api/team", {
      method: "DELETE",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ type: "invite", email }),
    });
    setTeamInvites((prev) => prev.filter((i) => i.email !== email));
  }

  async function updateMemberRole(memberId: string, role: string) {
    const token = getStoredToken();
    const res = await fetch("/api/team", {
      method: "PATCH",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ user_id: memberId, role }),
    });
    const data = await res.json() as { ok: boolean };
    if (data.ok) {
      setTeamMembers((prev) => prev.map((m) => m.user_id === memberId ? { ...m, role } : m));
    }
  }

  useEffect(() => {
    if (activeTab === "admins" && isOwner) {
      loadTeam();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isOwner]);

  const [syncing, setSyncing] = useState(false);
  async function handleForceSync() {
    setSyncing(true);
    await forceSyncToServer();
    setSyncing(false);
  }

  // Account tab state
  const [newPassword, setNewPassword] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleChangePassword() {
    if (newPassword.length < 8) { setPwMsg({ ok: false, text: "Password must be at least 8 characters." }); return; }
    if (newPassword !== pwConfirm) { setPwMsg({ ok: false, text: "Passwords do not match." }); return; }
    setPwSaving(true);
    setPwMsg(null);
    try {
      await updatePassword(newPassword);
      setNewPassword("");
      setPwConfirm("");
      setPwMsg({ ok: true, text: "Password updated." });
    } catch (e) {
      setPwMsg({ ok: false, text: (e as Error).message });
    } finally {
      setPwSaving(false);
    }
  }

  // WiFi shortcut form state
  const [wifiSsids, setWifiSsids] = useState<string[]>([]);
  const [wifiSsidInput, setWifiSsidInput] = useState("");
  const [wifiLabel, setWifiLabel] = useState("");
  const [wifiLat, setWifiLat] = useState("");
  const [wifiLon, setWifiLon] = useState("");
  const [wifiGeoLoading, setWifiGeoLoading] = useState(false);

  // Address geocoding state
  const [addressQuery, setAddressQuery] = useState("");
  const [addressResults, setAddressResults] = useState<{ display_name: string; lat: string; lon: string }[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const addressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function addSsidToList() {
    const trimmed = wifiSsidInput.trim();
    if (!trimmed || wifiSsids.includes(trimmed)) return;
    setWifiSsids((prev) => [...prev, trimmed]);
    setWifiSsidInput("");
  }

  async function searchAddress(q: string) {
    if (!q.trim()) return;
    setAddressLoading(true);
    setAddressResults([]);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=0`,
        { headers: { "Accept-Language": "en", "User-Agent": "123MobileTrack/1.0" } },
      );
      const data = await res.json() as { display_name: string; lat: string; lon: string }[];
      setAddressResults(data);
    } catch {
      setAddressResults([]);
    } finally {
      setAddressLoading(false);
    }
  }

  function useMyLocation() {
    if (!("geolocation" in navigator)) return;
    setWifiGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setWifiLat(pos.coords.latitude.toFixed(6));
        setWifiLon(pos.coords.longitude.toFixed(6));
        setWifiGeoLoading(false);
      },
      () => setWifiGeoLoading(false),
      { timeout: 10000, maximumAge: 60000 },
    );
  }

  const wifiReady =
    wifiSsids.length > 0 &&
    !isNaN(parseFloat(wifiLat)) &&
    !isNaN(parseFloat(wifiLon));

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

  // OTA firmware state
  const [otaFile, setOtaFile] = useState<File | null>(null);
  const [otaVersion, setOtaVersion] = useState("");
  const [otaUploading, setOtaUploading] = useState(false);
  const [otaMsg, setOtaMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [otaShowUpload, setOtaShowUpload] = useState(false);
  type OtaTrackerInfo = { vehicleName: string; deviceId: string; firmware: string | null };
  type OtaStatus = { deployed: { version: string; uploaded_at: string } | null; trackers: OtaTrackerInfo[] };
  const [otaStatus, setOtaStatus] = useState<OtaStatus | null>(null);

  useEffect(() => {
    if (activeTab === "tracking" && isOwner) {
      const token = getStoredToken();
      fetch("/api/fleet/ota/trackers", {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      })
        .then((r) => r.json())
        .then((d: OtaStatus & { ok: boolean }) => { if (d.ok) setOtaStatus(d); })
        .catch(() => null);
    }
  }, [activeTab, isOwner]);

  function extractVersion(filename: string): string {
    return filename.match(/(\d+\.\d+\.\d+)/)?.[1] ?? "";
  }

  async function uploadFirmware() {
    if (!otaFile || !otaVersion.trim()) return;
    setOtaUploading(true);
    setOtaMsg(null);
    try {
      const token = getStoredToken();
      const buf = await otaFile.arrayBuffer();
      const res = await fetch(`/api/fleet/ota/upload?version=${encodeURIComponent(otaVersion.trim())}`, {
        method: "POST",
        headers: {
          "content-type": "application/octet-stream",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: buf,
      });
      const data = await res.json() as { ok: boolean; version?: string; size?: number; error?: string };
      if (data.ok) {
        setOtaMsg({ ok: true, text: `v${data.version} deployed. Trackers will update on next check-in.` });
        setOtaStatus((prev) => prev ? { ...prev, deployed: { version: data.version!, uploaded_at: new Date().toISOString() } } : prev);
        setOtaFile(null);
        setOtaVersion("");
        setOtaShowUpload(false);
      } else {
        setOtaMsg({ ok: false, text: data.error ?? "Upload failed." });
      }
    } catch {
      setOtaMsg({ ok: false, text: "Network error." });
    } finally {
      setOtaUploading(false);
    }
  }

  const tabs: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: "account", label: "Account", icon: <KeyRound size={15} /> },
    { id: "company", label: "Company", icon: <SlidersHorizontal size={15} /> },
    ...(isOwner ? [{ id: "admins" as Tab, label: "Admins", icon: <Users size={15} /> }] : []),
    { id: "tracking", label: "Tracking", icon: <Mail size={15} /> },
    { id: "wifi", label: "WiFi", icon: <Wifi size={15} /> },
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

      {/* Account tab */}
      {activeTab === "account" && (
        <div className="grid gap-5 xl:grid-cols-2">
          <SectionCard className="p-5">
            <h2 className="text-base font-semibold text-brand-ink">Signed-in account</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-md border border-brand-line px-4 py-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Email</p>
                <p className="mt-1 font-semibold text-brand-ink">{user?.email ?? "—"}</p>
              </div>
              <div className={`flex items-center justify-between rounded-md border px-4 py-3 ${serverSynced ? "border-brand-line" : "border-amber-200 bg-amber-50"}`}>
                <div className="flex items-center gap-2">
                  {serverSynced
                    ? <CheckCircle2 size={14} className="text-brand-forest shrink-0" />
                    : <CloudOff size={14} className="text-amber-500 shrink-0" />}
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">Server sync</p>
                    <p className={`mt-0.5 font-medium ${serverSynced ? "text-brand-forest" : "text-amber-700"}`}>
                      {serverSynced ? "Synced" : user ? "Not synced — live tracking unavailable" : "Sign in to enable live tracking"}
                    </p>
                  </div>
                </div>
                {!serverSynced && user && (
                  <button
                    onClick={handleForceSync}
                    disabled={syncing}
                    className="flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50 shrink-0"
                  >
                    <RefreshCw size={12} className={syncing ? "animate-spin" : ""} />
                    {syncing ? "Syncing…" : "Sync now"}
                  </button>
                )}
              </div>
            </div>
            <div className="mt-4 border-t border-brand-line pt-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-brand-ink">Push notifications</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {pushStatus === "granted"
                    ? "Alerts enabled for this device."
                    : pushStatus === "denied"
                    ? "Blocked — check browser settings."
                    : pushStatus === "unsupported"
                    ? "Not supported in this browser."
                    : "Get alerted on this device when events fire."}
                </p>
              </div>
              {pushStatus === "granted" ? (
                <button onClick={handleDisablePush} disabled={pushLoading} className="flex items-center gap-1.5 rounded-md border border-brand-line px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-brand-cloud disabled:opacity-50">
                  {pushLoading ? "…" : "Disable"}
                </button>
              ) : pushStatus !== "unsupported" && pushStatus !== "denied" ? (
                <button onClick={handleEnablePush} disabled={pushLoading} className="flex items-center gap-1.5 rounded-md border border-brand-navy bg-brand-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-forest disabled:opacity-50">
                  {pushLoading ? "…" : "Enable"}
                </button>
              ) : null}
            </div>
            <div className="mt-4 border-t border-brand-line pt-4">
              <Button variant="secondary" onClick={handleLogout} className="flex items-center gap-2 text-red-600 hover:bg-red-50">
                <LogOut size={14} />
                Sign out
              </Button>
            </div>
          </SectionCard>

          <SectionCard className="p-5">
            <h2 className="text-base font-semibold text-brand-ink">Change password</h2>
            <p className="mt-1 text-xs text-slate-500">Must be at least 8 characters.</p>
            <div className="mt-4 space-y-3">
              <input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-10 w-full rounded-md border border-brand-line bg-brand-cloud px-3 text-sm outline-none transition focus:border-brand-forest"
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={pwConfirm}
                onChange={(e) => setPwConfirm(e.target.value)}
                className="h-10 w-full rounded-md border border-brand-line bg-brand-cloud px-3 text-sm outline-none transition focus:border-brand-forest"
              />
              {pwMsg && (
                <p className={`text-xs font-medium ${pwMsg.ok ? "text-brand-forest" : "text-red-600"}`}>
                  {pwMsg.text}
                </p>
              )}
              <Button
                onClick={handleChangePassword}
                disabled={pwSaving || !newPassword || !pwConfirm}
              >
                {pwSaving ? "Saving…" : "Change password"}
              </Button>
            </div>
          </SectionCard>
        </div>
      )}

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
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase text-slate-500">Timezone</p>
                    {editingTimezone ? (
                      <select
                        className="mt-2 h-9 rounded-md border border-brand-line px-2 text-sm"
                        value={state.timezone}
                        onChange={(e) => { updateTimezone(e.target.value); setEditingTimezone(false); }}
                        autoFocus
                      >
                        <option value="America/New_York">Eastern (ET)</option>
                        <option value="America/Chicago">Central (CT)</option>
                        <option value="America/Denver">Mountain (MT)</option>
                        <option value="America/Phoenix">Arizona (no DST)</option>
                        <option value="America/Los_Angeles">Pacific (PT)</option>
                        <option value="America/Anchorage">Alaska (AKT)</option>
                        <option value="Pacific/Honolulu">Hawaii (HT)</option>
                      </select>
                    ) : (
                      <p className="mt-1 font-semibold text-brand-ink">{state.timezone.replace("America/", "").replace("_", " ")}</p>
                    )}
                  </div>
                  {!editingTimezone ? (
                    <button
                      onClick={() => setEditingTimezone(true)}
                      className="shrink-0 rounded-md border border-brand-line px-3 py-1.5 text-xs font-medium hover:bg-brand-cloud"
                    >
                      Change
                    </button>
                  ) : (
                    <button onClick={() => setEditingTimezone(false)} className="shrink-0 text-xs text-slate-400 hover:text-brand-ink">
                      Cancel
                    </button>
                  )}
                </div>
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
                <p className="mt-1 font-semibold text-brand-ink">123mobiletrack.com</p>
                <p className="text-xs text-slate-500">Netlify · Serverless functions + Blob storage</p>
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

      {/* Admins / Team tab */}
      {activeTab === "admins" && (
        <div className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-2">
            {/* Left: Team members + pending invites */}
            <div className="space-y-5">
              <SectionCard className="overflow-hidden">
                <div className="border-b border-brand-line px-5 py-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-brand-ink">Team members</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Registered accounts with access to this fleet.</p>
                  </div>
                  {teamLoading
                    ? <Loader2 size={14} className="animate-spin text-slate-400 shrink-0" />
                    : <button onClick={loadTeam} className="text-xs text-slate-400 hover:text-brand-ink">Refresh</button>
                  }
                </div>
                <div className="divide-y divide-brand-line">
                  {teamMembers.length === 0 && !teamLoading && (
                    <div className="px-5 py-8 text-center text-sm text-slate-400">No members loaded.</div>
                  )}
                  {teamMembers.map((member) => {
                    const isSelf = member.user_id === user?.id;
                    const tz = state.timezone ?? "America/New_York";
                    return (
                      <div key={member.user_id} className="px-5 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-brand-ink">
                                {member.full_name ?? member.email.split("@")[0]}
                              </p>
                              <RoleBadge role={member.role} />
                              {isSelf && <span className="text-xs text-slate-400">(you)</span>}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">{member.email}</p>
                            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                              <Clock size={10} />
                              {formatLastLogin(member.last_sign_in_at, tz)}
                            </p>
                          </div>
                          {!isSelf && member.role !== "owner" && (
                            <div className="flex items-center gap-2 shrink-0">
                              {/* Inline role segmented control */}
                              <div className="flex rounded-md border border-brand-line overflow-hidden text-xs font-medium">
                                {(["admin", "driver"] as const).map((r) => (
                                  <button
                                    key={r}
                                    onClick={() => { if (member.role !== r) updateMemberRole(member.user_id, r); }}
                                    className={`px-2.5 py-1 transition-colors capitalize ${
                                      member.role === r
                                        ? "bg-brand-navy text-white"
                                        : "bg-white text-slate-500 hover:bg-brand-cloud"
                                    }`}
                                  >
                                    {r}
                                  </button>
                                ))}
                              </div>
                              {confirmRemoveMemberId === member.user_id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => removeMember(member.user_id)}
                                    className="rounded px-1.5 py-0.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 hover:bg-red-100"
                                  >
                                    Remove
                                  </button>
                                  <button
                                    onClick={() => setConfirmRemoveMemberId(null)}
                                    className="text-xs text-slate-400 hover:text-slate-600 px-1"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmRemoveMemberId(member.user_id)}
                                  className="text-slate-400 hover:text-red-500 transition-colors"
                                  title="Remove member"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>

              {/* Pending invites */}
              {teamInvites.length > 0 && (
                <SectionCard className="overflow-hidden">
                  <div className="border-b border-brand-line px-5 py-4">
                    <h2 className="text-base font-semibold text-brand-ink">Pending invites</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Waiting for these users to create an account.</p>
                  </div>
                  <div className="divide-y divide-brand-line">
                    {teamInvites.map((invite) => (
                      <div key={invite.email} className="flex items-center justify-between gap-3 px-5 py-3">
                        <div className="min-w-0">
                          <p className="text-sm text-brand-ink">{invite.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <RoleBadge role={invite.role} />
                            <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-700">
                              Pending
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => cancelInvite(invite.email)}
                          className="text-slate-400 hover:text-red-500 transition-colors shrink-0"
                          title="Cancel invite"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}
            </div>

            {/* Right: Invite form + alert recipients */}
            <div className="space-y-5">
              <SectionCard className="p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-brand-mint p-3 text-brand-forest">
                    <UserPlus size={18} />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-brand-ink">Invite member</h2>
                    <p className="text-sm text-slate-500">They can sign up and join your fleet.</p>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  <label className="block text-sm font-medium text-brand-text">
                    Email address
                    <input
                      className="mt-2 h-10 w-full rounded-md border border-brand-line px-3 text-sm"
                      type="email"
                      placeholder="driver@example.com"
                      value={inviteEmail}
                      onChange={(e) => { setInviteEmail(e.target.value); setInviteMsg(null); }}
                    />
                  </label>
                  <label className="block text-sm font-medium text-brand-text">
                    Role
                    <select
                      className="mt-2 h-10 w-full rounded-md border border-brand-line bg-white px-3 text-sm"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as "admin" | "driver")}
                    >
                      <option value="admin">Admin — full fleet access</option>
                      <option value="driver">Driver — own trips &amp; alerts only</option>
                    </select>
                  </label>
                  {inviteMsg && (
                    <p className={`text-xs font-medium ${inviteMsg.ok ? "text-brand-forest" : "text-red-600"}`}>
                      {inviteMsg.text}
                    </p>
                  )}
                  <Button
                    disabled={!inviteEmail.includes("@") || inviteSending}
                    onClick={sendInvite}
                  >
                    <UserPlus size={15} className="mr-2" />
                    {inviteSending ? "Sending…" : "Send invite"}
                  </Button>
                  <p className="text-xs text-slate-400">
                    They&apos;ll join automatically when they sign up with this email.
                  </p>
                </div>
              </SectionCard>

              {/* Alert recipients (existing) */}
              <SectionCard className="overflow-hidden">
                <div className="border-b border-brand-line px-5 py-4">
                  <h2 className="text-base font-semibold text-brand-ink">Alert recipients</h2>
                  <p className="text-sm text-slate-500">
                    These contacts receive email alerts for the event types selected.
                  </p>
                </div>
                <div className="divide-y divide-brand-line">
                  {state.admins.map((admin) => (
                    <div key={admin.id} className="px-5 py-4">
                      {editingAdminId === admin.id ? (
                        <div className="space-y-3">
                          <input
                            className="h-9 w-full rounded-md border border-brand-line bg-brand-cloud px-3 text-sm outline-none focus:border-brand-forest"
                            placeholder="Name"
                            value={editAdminName}
                            onChange={(e) => setEditAdminName(e.target.value)}
                          />
                          <input
                            className="h-9 w-full rounded-md border border-brand-line bg-brand-cloud px-3 text-sm outline-none focus:border-brand-forest"
                            type="email"
                            placeholder="Email"
                            value={editAdminEmail}
                            onChange={(e) => setEditAdminEmail(e.target.value)}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => { updateAdmin(admin.id, { name: editAdminName, email: editAdminEmail }); setEditingAdminId(null); }}
                              disabled={!editAdminEmail.includes("@")}
                              className="rounded-md bg-brand-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-forest disabled:opacity-40"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingAdminId(null)}
                              className="rounded-md border border-brand-line px-3 py-1.5 text-xs font-medium hover:bg-brand-cloud"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
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
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => { setEditingAdminId(admin.id); setEditAdminName(admin.name); setEditAdminEmail(admin.email); }}
                                className="text-slate-400 hover:text-brand-ink transition-colors"
                                title="Edit"
                              >
                                <Pencil size={14} />
                              </button>
                              {!admin.isPrimary && (
                                confirmRemoveAdminId === admin.id ? (
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() => { removeAdmin(admin.id); setConfirmRemoveAdminId(null); }}
                                      className="rounded px-2 py-0.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 hover:bg-red-100"
                                    >
                                      Remove
                                    </button>
                                    <button
                                      onClick={() => setConfirmRemoveAdminId(null)}
                                      className="rounded px-2 py-0.5 text-xs text-slate-400 hover:text-slate-600"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setConfirmRemoveAdminId(admin.id)}
                                    className="text-slate-400 hover:text-red-500 transition-colors"
                                    title="Remove"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {ALERT_TYPES.map((type) => {
                              const enabled = admin.alertTypes.includes(type.id);
                              return (
                                <button
                                  key={type.id}
                                  onClick={() => updateAdminAlerts(admin.id, enabled ? admin.alertTypes.filter((t) => t !== type.id) : [...admin.alertTypes, type.id])}
                                  className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${enabled ? "border-brand-forest bg-brand-mint text-brand-forest" : "border-brand-line bg-white text-slate-400"}`}
                                >
                                  {type.label}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                <div className="border-t border-brand-line px-5 py-4 space-y-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">Add recipient</p>
                  <div className="flex gap-2">
                    <input
                      className="h-9 flex-1 rounded-md border border-brand-line px-3 text-sm"
                      placeholder="Name (optional)"
                      value={newAdminName}
                      onChange={(e) => setNewAdminName(e.target.value)}
                    />
                    <input
                      className="h-9 flex-1 rounded-md border border-brand-line px-3 text-sm"
                      type="email"
                      placeholder="Email"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ALERT_TYPES.map((type) => {
                      const enabled = newAdminAlerts.includes(type.id);
                      return (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => setNewAdminAlerts((prev) => enabled ? prev.filter((t) => t !== type.id) : [...prev, type.id])}
                          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${enabled ? "border-brand-forest bg-brand-mint text-brand-forest" : "border-brand-line bg-white text-slate-400"}`}
                        >
                          {type.label}
                        </button>
                      );
                    })}
                  </div>
                  <Button
                    disabled={!newAdminEmail.includes("@")}
                    onClick={() => {
                      addAdmin({ name: newAdminName || newAdminEmail, email: newAdminEmail, alertTypes: newAdminAlerts });
                      setNewAdminEmail(""); setNewAdminName("");
                      setNewAdminAlerts(["hard_brake", "rapid_accel", "speeding"]);
                    }}
                  >
                    <UserPlus size={15} className="mr-2" />
                    Add recipient
                  </Button>
                </div>
              </SectionCard>
            </div>
          </div>
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

          <div className="space-y-5">
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
                  ["Min moving speed", "4 mph (TRACKER_MIN_MOVING_SPEED_KPH)"],
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

            {isOwner && (
              <SectionCard className="overflow-hidden">
                <div className="border-b border-brand-line px-5 py-4 flex items-center gap-3">
                  <Upload size={16} className="text-brand-navy" />
                  <div>
                    <h2 className="text-base font-semibold text-brand-ink">Firmware</h2>
                    <p className="text-xs text-slate-400">
                      {otaStatus?.deployed
                        ? `Latest deployed: v${otaStatus.deployed.version}`
                        : "No firmware deployed yet"}
                    </p>
                  </div>
                </div>

                {/* Per-tracker status */}
                {otaStatus && otaStatus.trackers.length > 0 ? (
                  <div className="divide-y divide-brand-line">
                    {otaStatus.trackers.map((t) => {
                      const deployed = otaStatus.deployed?.version ?? null;
                      const upToDate = deployed && t.firmware === deployed;
                      const noData = !t.firmware;
                      return (
                        <div key={t.deviceId} className="flex items-center justify-between gap-3 px-5 py-3">
                          <div>
                            <p className="text-sm font-semibold text-brand-ink">{t.vehicleName}</p>
                            <p className="text-xs text-slate-400 font-mono">{t.deviceId}</p>
                          </div>
                          <div className="text-right shrink-0">
                            {noData ? (
                              <span className="text-xs text-slate-400">No data yet</span>
                            ) : upToDate ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-brand-mint px-2.5 py-0.5 text-xs font-medium text-brand-forest">
                                <CheckCircle2 size={11} /> v{t.firmware}
                              </span>
                            ) : (
                              <div>
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                                  v{t.firmware ?? "unknown"} → update pending
                                </span>
                                <p className="mt-0.5 text-xs text-slate-400">Updates on next check-in</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : otaStatus ? (
                  <p className="px-5 py-6 text-sm text-slate-400">No trackers with devices assigned.</p>
                ) : (
                  <div className="flex items-center gap-2 px-5 py-4 text-xs text-slate-400">
                    <Loader2 size={13} className="animate-spin" /> Loading…
                  </div>
                )}

                {/* Upload new firmware */}
                <div className="border-t border-brand-line px-5 py-4">
                  <button
                    onClick={() => { setOtaShowUpload((v) => !v); setOtaMsg(null); }}
                    className="flex items-center gap-2 text-sm font-medium text-brand-forest hover:underline"
                  >
                    <Upload size={13} />
                    {otaShowUpload ? "Hide upload" : "Upload new firmware…"}
                  </button>

                  {otaShowUpload && (
                    <div className="mt-4 space-y-3">
                      <div>
                        <p className="text-sm font-medium text-brand-text">Firmware binary (.bin)</p>
                        <label className="mt-2 flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-brand-line bg-brand-cloud px-4 py-3 hover:border-brand-forest transition-colors">
                          <Upload size={16} className="text-slate-400 shrink-0" />
                          <span className="text-sm text-slate-500 truncate">
                            {otaFile ? otaFile.name : "Choose firmware.bin…"}
                          </span>
                          <input
                            type="file"
                            accept=".bin"
                            className="sr-only"
                            onChange={(e) => {
                              const f = e.target.files?.[0] ?? null;
                              setOtaFile(f);
                              setOtaMsg(null);
                              if (f) setOtaVersion(extractVersion(f.name));
                            }}
                          />
                        </label>
                      </div>

                      <label className="block text-sm font-medium text-brand-text">
                        Version number
                        <input
                          className="mt-2 h-10 w-full rounded-md border border-brand-line bg-brand-cloud px-3 font-mono text-sm outline-none transition focus:border-brand-forest"
                          placeholder="e.g. 0.6.7"
                          value={otaVersion}
                          onChange={(e) => { setOtaVersion(e.target.value); setOtaMsg(null); }}
                        />
                      </label>

                      {otaMsg && (
                        <p className={`text-xs font-medium ${otaMsg.ok ? "text-brand-forest" : "text-red-600"}`}>
                          {otaMsg.text}
                        </p>
                      )}

                      <Button
                        disabled={!otaFile || !otaVersion.trim() || otaUploading}
                        onClick={uploadFirmware}
                      >
                        {otaUploading ? (
                          <><Loader2 size={15} className="mr-2 animate-spin" />Uploading…</>
                        ) : (
                          <><Upload size={15} className="mr-2" />Upload &amp; deploy</>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </SectionCard>
            )}
          </div>
        </div>
      )}

      {/* WiFi tab */}
      {activeTab === "wifi" && (
        <div className="space-y-5">
          {/* Explanation callout */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-5 py-4">
            <p className="text-sm font-semibold text-blue-800">What are WiFi shortcuts?</p>
            <p className="mt-1 text-sm text-blue-700">
              GPS stops working inside garages, shops, and buildings. When a tracker loses GPS signal,
              it picks up nearby WiFi network names instead. If one of those names matches a shortcut
              you&apos;ve saved here, the app uses your saved address as the truck&apos;s location — so
              it still shows up correctly on the map even when parked indoors.
            </p>
            <p className="mt-2 text-sm text-blue-700">
              Save one shortcut per location (shop, yard, warehouse). If the building has more than
              one WiFi network, add all the network names to the same shortcut.
            </p>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <SectionCard className="overflow-hidden">
              <div className="border-b border-brand-line px-5 py-4">
                <h2 className="text-base font-semibold text-brand-ink">Saved shortcuts</h2>
              </div>
              {(state.wifiShortcuts ?? []).length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-slate-400">
                  No shortcuts saved yet. Add one using the form.
                </div>
              ) : (
                <div className="divide-y divide-brand-line">
                  {(state.wifiShortcuts ?? []).map((s: WifiShortcut) => {
                    const allSsids = s.ssids?.length ? s.ssids : (s.ssid ? [s.ssid] : []);
                    return (
                      <div key={s.id} className="flex items-start justify-between gap-3 px-5 py-4">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-brand-ink">{s.label}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {allSsids.map((ssid) => (
                              <span key={ssid} className="rounded bg-brand-cloud px-2 py-0.5 text-xs font-mono text-slate-600 border border-brand-line">
                                {ssid}
                              </span>
                            ))}
                          </div>
                          <p className="mt-1 text-xs text-slate-400">
                            {Number(s.lat).toFixed(5)}, {Number(s.lon).toFixed(5)}
                          </p>
                        </div>
                        {confirmRemoveWifiId === s.id ? (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => { removeWifiShortcut(s.id); setConfirmRemoveWifiId(null); }}
                              className="rounded px-2 py-0.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 hover:bg-red-100"
                            >
                              Remove
                            </button>
                            <button
                              onClick={() => setConfirmRemoveWifiId(null)}
                              className="rounded px-2 py-0.5 text-xs text-slate-400 hover:text-slate-600"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmRemoveWifiId(s.id)}
                            className="text-slate-400 hover:text-red-500 transition-colors shrink-0"
                            title="Remove shortcut"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            <SectionCard className="p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-brand-mint p-3 text-brand-forest">
                  <MapPin size={18} />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-brand-ink">Add shortcut</h2>
                  <p className="text-sm text-slate-500">One shortcut per physical location.</p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {/* WiFi networks */}
                <div>
                  <p className="text-sm font-medium text-brand-text">WiFi network names (SSID)</p>
                  <p className="mt-0.5 text-xs text-slate-400">Add every network name visible at this location.</p>
                  {wifiSsids.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {wifiSsids.map((ssid) => (
                        <span key={ssid} className="flex items-center gap-1 rounded-full border border-brand-line bg-brand-cloud px-2.5 py-1 text-xs font-mono text-brand-ink">
                          {ssid}
                          <button onClick={() => setWifiSsids((p) => p.filter((s) => s !== ssid))} className="text-slate-400 hover:text-red-500">
                            <X size={11} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex gap-2">
                    <input
                      className="h-10 flex-1 rounded-md border border-brand-line bg-brand-cloud px-3 text-sm font-mono outline-none transition focus:border-brand-forest"
                      placeholder="e.g. DepotWifi"
                      value={wifiSsidInput}
                      onChange={(e) => setWifiSsidInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSsidToList(); } }}
                    />
                    <button
                      type="button"
                      onClick={addSsidToList}
                      disabled={!wifiSsidInput.trim()}
                      className="rounded-md border border-brand-line px-3 text-sm font-medium hover:bg-brand-cloud disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Label */}
                <label className="block text-sm font-medium text-brand-text">
                  Location label
                  <input
                    className="mt-2 h-10 w-full rounded-md border border-brand-line bg-brand-cloud px-3 text-sm outline-none transition focus:border-brand-forest"
                    placeholder="e.g. Main Depot, Warehouse B"
                    value={wifiLabel}
                    onChange={(e) => setWifiLabel(e.target.value)}
                  />
                </label>

                {/* Coordinates */}
                <div>
                  <p className="text-sm font-medium text-brand-text">Location coordinates</p>

                  {/* Address autofill */}
                  <div className="relative mt-2">
                    <div className="relative">
                      <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        className="h-10 w-full rounded-md border border-brand-line bg-brand-cloud pl-8 pr-3 text-sm outline-none transition focus:border-brand-forest"
                        placeholder="Type an address…"
                        autoComplete="off"
                        value={addressQuery}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAddressQuery(val);
                          setAddressResults([]);
                          if (addressTimerRef.current) clearTimeout(addressTimerRef.current);
                          if (val.trim().length >= 3) {
                            addressTimerRef.current = setTimeout(() => searchAddress(val), 350);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") { setAddressQuery(""); setAddressResults([]); }
                        }}
                      />
                      {addressLoading && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">…</span>
                      )}
                    </div>
                    {addressResults.length > 0 && (
                      <ul className="absolute z-10 mt-1 w-full rounded-md border border-brand-line bg-white shadow-md">
                        {addressResults.map((r, i) => (
                          <li key={i}>
                            <button
                              type="button"
                              className="w-full px-3 py-2.5 text-left text-xs hover:bg-brand-cloud"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setWifiLat(parseFloat(r.lat).toFixed(6));
                                setWifiLon(parseFloat(r.lon).toFixed(6));
                                setAddressQuery(r.display_name.split(",").slice(0, 3).join(","));
                                setAddressResults([]);
                              }}
                            >
                              <span className="font-medium text-brand-ink">{r.display_name.split(",").slice(0, 2).join(",")}</span>
                              <span className="ml-1 text-slate-400">{r.display_name.split(",").slice(2, 4).join(",")}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="mt-2 flex gap-2">
                    <input
                      className="h-10 flex-1 rounded-md border border-brand-line bg-brand-cloud px-3 text-sm font-mono outline-none transition focus:border-brand-forest"
                      placeholder="Latitude"
                      value={wifiLat}
                      onChange={(e) => setWifiLat(e.target.value)}
                    />
                    <input
                      className="h-10 flex-1 rounded-md border border-brand-line bg-brand-cloud px-3 text-sm font-mono outline-none transition focus:border-brand-forest"
                      placeholder="Longitude"
                      value={wifiLon}
                      onChange={(e) => setWifiLon(e.target.value)}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={useMyLocation}
                    disabled={wifiGeoLoading}
                    className="mt-2 flex items-center gap-1.5 text-xs font-medium text-brand-forest hover:underline disabled:opacity-50"
                  >
                    <MapPin size={13} />
                    {wifiGeoLoading ? "Getting location…" : "Use my current location"}
                  </button>
                </div>

                <Button
                  disabled={!wifiReady}
                  onClick={() => {
                    addWifiShortcut({
                      ssids: wifiSsids,
                      label: wifiLabel.trim() || wifiSsids[0],
                      lat: parseFloat(wifiLat),
                      lon: parseFloat(wifiLon),
                    });
                    setWifiSsids([]);
                    setWifiSsidInput("");
                    setWifiLabel("");
                    setWifiLat("");
                    setWifiLon("");
                    setAddressQuery("");
                    setAddressResults([]);
                  }}
                >
                  <Wifi size={15} className="mr-2" />
                  Save shortcut
                </Button>
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      <SetupWorkspaceModal open={companyOpen} onClose={() => setCompanyOpen(false)} />
    </div>
  );
}
