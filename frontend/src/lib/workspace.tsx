"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { Driver, Geofence, MaintenanceItem, Vehicle } from "@/types";
import { useAllTrackers } from "@/lib/liveTracker";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { UserRole } from "@/lib/permissions";

type DateRangeOption = "Today" | "Last 7 days" | "Last 30 days" | "This month";

export type WifiShortcut = {
  id: string;
  ssids: string[];  // one or more network names for this location
  ssid?: string;    // legacy field — old records only, do not write
  label: string;
  lat: number;
  lon: number;
};

export type Admin = {
  id: string;
  name: string;
  email: string;
  alertTypes: string[];
  isPrimary?: boolean;
};

export type TrackingProfile = {
  movingIntervalS: number;
  stoppedIntervalS: number;
  idleTimeoutMin: number;
  deepSleepTimeoutMin: number;
  heartbeatIntervalMin: number;
};

export type ServiceAreaOption = {
  id: string;
  label: string;
  center: [number, number];
};

type WorkspaceState = {
  companyName: string;
  serviceAreaId: string;
  timezone: string;
  adminName: string;
  adminEmail: string;
  dateRange: DateRangeOption;
  setupComplete: boolean;
  vehicles: Vehicle[];
  drivers: Driver[];
  trackerAssignmentVehicleId: string | null;
  admins: Admin[];
  trackingProfile: TrackingProfile;
  maintenanceItems: MaintenanceItem[];
  geofences: Geofence[];
  wifiShortcuts: WifiShortcut[];
};

type WorkspaceContextValue = {
  state: WorkspaceState;
  loaded: boolean;
  userRole: UserRole;
  driverVehicleId: string | null;
  serviceArea: ServiceAreaOption;
  hasServiceArea: boolean;
  serverSynced: boolean;
  forceSyncToServer: () => Promise<void>;
  notifications: { id: string; title: string; detail: string }[];
  liveTrackers: import("@/lib/liveTracker").LiveTrackerPacket[];
  setDateRange: (value: DateRangeOption) => void;
  completeSetup: (payload: {
    companyName: string;
    serviceAreaId: string;
    timezone: string;
    adminName: string;
    adminEmail: string;
  }) => void;
  addVehicle: (payload: {
    name: string;
    vehicleNumber: string;
    plate: string;
    make: string;
    model: string;
    year: number;
    type: string;
    notes: string;
    installDate: string;
    enabledFeatures: string[];
    photo?: string;
    color?: string;
    deviceAssignment?: string;
  }) => void;
  addDriver: (payload: { name: string; phone: string; license: string; notes: string }) => void;
  updateDriver: (id: string, updates: Partial<Pick<Driver, "name" | "phone" | "license" | "notes">>) => void;
  removeDriver: (id: string) => void;
  assignTrackerToVehicle: (vehicleId: string, trackerId: string) => void;
  addAdmin: (payload: { name: string; email: string; alertTypes: string[] }) => void;
  removeAdmin: (adminId: string) => void;
  updateAdmin: (adminId: string, updates: { name?: string; email?: string }) => void;
  updateAdminAlerts: (adminId: string, alertTypes: string[]) => void;
  updateTrackingProfile: (profile: Partial<TrackingProfile>) => void;
  addMaintenanceItem: (item: Omit<MaintenanceItem, "id">) => void;
  updateMaintenanceItem: (id: string, updates: Partial<Omit<MaintenanceItem, "id">>) => void;
  removeMaintenanceItem: (id: string) => void;
  addGeofence: (item: Omit<Geofence, "id">) => void;
  updateGeofence: (id: string, updates: Partial<Omit<Geofence, "id">>) => void;
  removeGeofence: (id: string) => void;
  updateTimezone: (tz: string) => void;
  addWifiShortcut: (item: Omit<WifiShortcut, "id">) => void;
  removeWifiShortcut: (id: string) => void;
  updateVehicle: (id: string, updates: Partial<Vehicle>) => void;
  removeVehicle: (id: string) => void;
  assignDriverToVehicle: (vehicleId: string, driverId: string) => void;
  removeDriverFromVehicle: (vehicleId: string, driverId: string) => void;
};

const STORAGE_KEY = "mobile-track-workspace";
const unsetServiceArea: ServiceAreaOption = {
  id: "",
  label: "Not set",
  center: [40.7128, -74.006],
};

export const serviceAreaOptions: ServiceAreaOption[] = [
  { id: "north-jersey", label: "North Jersey", center: [40.7357, -74.1724] },
  { id: "essex-county", label: "Essex County", center: [40.7866, -74.2479] },
  { id: "hudson-county", label: "Hudson County", center: [40.7449, -74.0288] },
  { id: "bergen-county", label: "Bergen County", center: [40.9263, -74.0770] },
  { id: "nyc-metro", label: "NYC Metro", center: [40.7128, -74.006] },
];

const defaultTrackingProfile: TrackingProfile = {
  movingIntervalS: 10,
  stoppedIntervalS: 60,
  idleTimeoutMin: 5,
  deepSleepTimeoutMin: 15,
  heartbeatIntervalMin: 30,
};

const defaultState: WorkspaceState = {
  companyName: "123 Mobile Track",
  serviceAreaId: "",
  timezone: "America/New_York",
  adminName: "Eamon Doherty",
  adminEmail: "ops@123mobiletrack.com",
  dateRange: "Last 7 days",
  setupComplete: false,
  vehicles: [],
  drivers: [],
  trackerAssignmentVehicleId: null,
  admins: [
    {
      id: "admin-primary",
      name: "Eamon Doherty",
      email: "ops@123mobiletrack.com",
      alertTypes: ["hard_brake", "rapid_accel", "speeding", "gps_offline"],
      isPrimary: true,
    },
  ],
  trackingProfile: defaultTrackingProfile,
  maintenanceItems: [],
  geofences: [],
  wifiShortcuts: [],
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function offsetPoint(center: [number, number], index: number): [number, number] {
  const latOffset = (index % 3) * 0.012 - 0.012;
  const lngOffset = Math.floor(index / 3) * 0.014 - 0.014;
  return [center[0] + latOffset, center[1] + lngOffset];
}

async function getOrCreateOrg(userId: string, email: string): Promise<string | null> {
  // Check existing membership
  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (membership?.org_id) return membership.org_id;

  // Check if this email was pre-invited — join that org instead of creating one
  const { data: invite } = await supabase
    .from("org_invites")
    .select("org_id, role")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();

  if (invite?.org_id) {
    await supabase.from("organization_members").insert({
      org_id: invite.org_id,
      user_id: userId,
      email: email.trim().toLowerCase(),
      role: invite.role ?? "admin",
    });
    // Clean up the invite row
    await supabase.from("org_invites").delete().eq("org_id", invite.org_id).eq("email", email.trim().toLowerCase());
    return invite.org_id;
  }

  // No membership — create a new org and make this user the owner
  const orgId = crypto.randomUUID();
  const { error: orgError } = await supabase
    .from("organizations")
    .insert({ id: orgId, name: "123 Mobile Track", admin_email: email });

  if (orgError) return null;

  await supabase.from("organization_members").insert({
    org_id: orgId,
    user_id: userId,
    email: email.trim().toLowerCase(),
    role: "owner",
  });

  return orgId;
}

async function fetchWorkspace(userId: string, email: string): Promise<WorkspaceState | null> {
  try {
    const orgId = await getOrCreateOrg(userId, email);
    if (!orgId) return null;

    const { data: org } = await supabase
      .from("organizations")
      .select("workspace_blob")
      .eq("id", orgId)
      .single();

    return (org?.workspace_blob as WorkspaceState) ?? null;
  } catch {
    return null;
  }
}

async function saveWorkspace(state: WorkspaceState, userId: string, email: string): Promise<boolean> {
  try {
    const orgId = await getOrCreateOrg(userId, email);
    if (!orgId) return false;

    const { error } = await supabase
      .from("organizations")
      .update({
        workspace_blob: state,
        name: state.companyName,
        service_area_id: state.serviceAreaId,
        timezone: state.timezone,
        admin_name: state.adminName,
        admin_email: state.adminEmail,
        setup_complete: state.setupComplete,
        tracker_assignment_vehicle_id: state.trackerAssignmentVehicleId ?? "",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orgId);

    return !error;
  } catch {
    return false;
  }
}

function migrateDriverAssignments(state: WorkspaceState) {
  for (const vehicle of state.vehicles) {
    if (!vehicle.assignedDriverIds) vehicle.assignedDriverIds = [];
    if (vehicle.assignedDriver && vehicle.assignedDriver !== "Not assigned" && vehicle.assignedDriverIds.length === 0) {
      const driver = state.drivers.find((d) => d.name === vehicle.assignedDriver);
      if (driver) vehicle.assignedDriverIds = [driver.id];
    }
  }
  for (const driver of state.drivers) {
    if (!driver.assignedVehicleIds) driver.assignedVehicleIds = [];
    if (driver.assignedVehicle && driver.assignedVehicle !== "Not assigned" && driver.assignedVehicleIds.length === 0) {
      const vehicle = state.vehicles.find((v) => v.name === driver.assignedVehicle);
      if (vehicle) driver.assignedVehicleIds = [vehicle.id];
    }
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, loaded: authLoaded } = useAuth();
  const [state, setState] = useState<WorkspaceState>(defaultState);
  const [serverLoaded, setServerLoaded] = useState(false);
  const [serverSynced, setServerSynced] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [driverVehicleId, setDriverVehicleId] = useState<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef<WorkspaceState>(defaultState);
  stateRef.current = state;

  // Reload workspace whenever the logged-in user changes (handles shared-device account switching).
  useEffect(() => {
    if (!authLoaded) return;

    setState(defaultState);
    setServerLoaded(false);
    setServerSynced(false);
    setUserRole(null);
    setDriverVehicleId(null);

    if (!user) {
      // Don't set serverLoaded=true here — keeps the save effect from firing with empty defaultState.
      return;
    }

    const userId = user.id;
    const email = user.email;

    async function load() {
      // Fetch role from org membership
      const { data: membership } = await supabase
        .from("organization_members")
        .select("role, org_id")
        .eq("user_id", userId)
        .maybeSingle();
      const role = (membership?.role ?? "owner") as UserRole;
      setUserRole(role);

      const serverState = await fetchWorkspace(userId, email);
      if (serverState) {
        const normalized = { ...defaultState, ...serverState };
        if (!normalized.setupComplete && normalized.serviceAreaId) normalized.serviceAreaId = "";
        // If localStorage has a newer timestamp or more items than the server copy,
        // prefer localStorage to avoid losing changes made since the last server sync.
        try {
          const raw = window.localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const local = JSON.parse(raw) as WorkspaceState & { _savedAt?: number };
            const serverTime = (serverState as WorkspaceState & { _savedAt?: number })._savedAt ?? 0;
            const localTime = local._savedAt ?? 0;
            if (localTime > serverTime) {
              // localStorage is newer — use it entirely and push to server
              const localNormalized = { ...defaultState, ...local };
              migrateDriverAssignments(localNormalized);
              setState(localNormalized);
              saveWorkspace(localNormalized, userId, email).then((ok) => { if (ok) setServerSynced(true); });
              setServerLoaded(true);
              return;
            }
            // Same age — recover any collections localStorage has more of
            if ((local.vehicles?.length ?? 0) > (normalized.vehicles?.length ?? 0)) normalized.vehicles = local.vehicles;
            if ((local.drivers?.length ?? 0) > (normalized.drivers?.length ?? 0)) normalized.drivers = local.drivers;
            if ((local.wifiShortcuts?.length ?? 0) > (normalized.wifiShortcuts?.length ?? 0)) normalized.wifiShortcuts = local.wifiShortcuts;
            if ((local.admins?.length ?? 1) > (normalized.admins?.length ?? 1)) normalized.admins = local.admins;
            if ((local.geofences?.length ?? 0) > (normalized.geofences?.length ?? 0)) normalized.geofences = local.geofences;
            if ((local.maintenanceItems?.length ?? 0) > (normalized.maintenanceItems?.length ?? 0)) normalized.maintenanceItems = local.maintenanceItems;
          }
        } catch { /* ignore */ }
        // Merge any vehicles/drivers the user added while the server was loading.
        // stateRef.current holds whatever setState calls ran during the async fetch.
        const pending = stateRef.current;
        const serverIds = new Set(normalized.vehicles.map((v) => v.id));
        const pendingNew = pending.vehicles.filter((v) => !serverIds.has(v.id));
        if (pendingNew.length > 0) normalized.vehicles = [...normalized.vehicles, ...pendingNew];
        const serverDriverIds = new Set(normalized.drivers.map((d) => d.id));
        const pendingNewDrivers = pending.drivers.filter((d) => !serverDriverIds.has(d.id));
        if (pendingNewDrivers.length > 0) normalized.drivers = [...normalized.drivers, ...pendingNewDrivers];

        migrateDriverAssignments(normalized);
        setState(normalized);
        setServerSynced(true);
        setServerLoaded(true);
        // For drivers: find their assigned vehicle by matching email
        if (role === "driver") {
          const driverRecord = normalized.drivers.find(
            (d) => d.email?.toLowerCase() === email.toLowerCase()
          );
          const vehicle = driverRecord?.assignedVehicleIds?.[0]
            ? normalized.vehicles.find((v) => v.id === driverRecord.assignedVehicleIds![0])
            : null;
          setDriverVehicleId(vehicle?.id ?? null);
        }
        return;
      }

      // Fall back to localStorage for existing users migrating from Netlify Blobs
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as WorkspaceState;
          const normalized = { ...defaultState, ...parsed };
          if (!normalized.setupComplete && normalized.serviceAreaId) normalized.serviceAreaId = "";
          migrateDriverAssignments(normalized);
          setState(normalized);
          const tryMigrate = async (attempt: number) => {
            const ok = await saveWorkspace(normalized, userId, email);
            if (ok) { setServerSynced(true); return; }
            if (attempt < 4) setTimeout(() => tryMigrate(attempt + 1), attempt * 2000 + 2000);
          };
          tryMigrate(0);
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      setServerLoaded(true);
    }
    load();
  }, [user?.id, authLoaded]);

  // Debounced save — write to both server and localStorage on every state change
  const debouncedSave = useCallback((nextState: WorkspaceState) => {
    const stamped = { ...nextState, _savedAt: Date.now() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stamped));
    setServerSynced(false);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      if (!user) return;
      const ok = await saveWorkspace(stamped, user.id, user.email);
      if (ok) setServerSynced(true);
    }, 1500);
  }, [user]);

  useEffect(() => {
    if (!serverLoaded) return;
    debouncedSave(state);
  }, [state, serverLoaded, debouncedSave]);

  const liveTrackers = useAllTrackers(user?.token ?? undefined);

  const serviceArea =
    serviceAreaOptions.find((option) => option.id === state.serviceAreaId) ?? unsetServiceArea;
  const hasServiceArea = Boolean(state.serviceAreaId);

  const notifications = useMemo(() => {
    const items: { id: string; title: string; detail: string }[] = [];

    if (!state.setupComplete) {
      items.push({
        id: "setup",
        title: "Finish company setup",
        detail: "Add your company name, service area, and contact details.",
      });
    }
    if (state.vehicles.length === 0) {
      items.push({
        id: "vehicle",
        title: "Add your first vehicle",
        detail: "Assign a tracker to a vehicle so trips, alerts, and history all stay organized.",
      });
    }

    // Maintenance due alerts (time-based check)
    const now = Date.now();
    for (const item of state.maintenanceItems) {
      if (!item.alertEnabled || item.intervalMonths === 0) continue;
      const monthsSince =
        (now - new Date(item.lastServiceDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
      if (monthsSince >= item.intervalMonths) {
        const vehicle = state.vehicles.find((v) => v.id === item.vehicleId);
        const vName = vehicle?.name ?? "Vehicle";
        items.push({
          id: `maint-${item.id}`,
          title: `${vName} — ${item.label} due`,
          detail: `Last service was ${Math.floor(monthsSince)} month${Math.floor(monthsSince) !== 1 ? "s" : ""} ago. Interval: every ${item.intervalMonths} months.`,
        });
      }
    }

    const assignedIds = new Set(state.vehicles.map((v) => v.deviceAssignment).filter(Boolean));
    for (const tracker of liveTrackers) {
      if (tracker.device_id && !assignedIds.has(tracker.device_id)) {
        items.push({
          id: `new-device-${tracker.device_id}`,
          title: `New tracker detected: ${tracker.device_id}`,
          detail: "Go to Devices to assign it to a vehicle.",
        });
      }
    }

    return items;
  }, [state.maintenanceItems, state.setupComplete, state.vehicles, liveTrackers]);

  const forceSyncToServer = useCallback(async () => {
    if (!user) return;
    const ok = await saveWorkspace(stateRef.current, user.id, user.email);
    if (ok) setServerSynced(true);
  }, [user]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      state,
      loaded: serverLoaded,
      userRole,
      driverVehicleId,
      serviceArea,
      hasServiceArea,
      serverSynced,
      liveTrackers,
      forceSyncToServer,
      notifications,
      setDateRange: (value) => setState((current) => ({ ...current, dateRange: value })),
      completeSetup: (payload) =>
        setState((current) => ({
          ...current,
          ...payload,
          setupComplete: true,
        })),
      addVehicle: (payload) =>
        setState((current) => {
          const nextIndex = current.vehicles.length + 1;
          const location = offsetPoint(
            hasServiceArea ? serviceArea.center : unsetServiceArea.center,
            nextIndex,
          );
          const vehicle: Vehicle = {
            id: `VH-${String(1000 + nextIndex)}`,
            name: payload.name,
            vehicleNumber: payload.vehicleNumber,
            plate: payload.plate,
            vin: "VIN pending",
            make: payload.make,
            model: payload.model,
            year: payload.year,
            type: payload.type,
            assignedDriver: "Not assigned",
            assignedDriverIds: [],
            region: hasServiceArea ? serviceArea.label : "Not set",
            status: "parked",
            gpsOnline: false,
            deviceStatus: current.trackerAssignmentVehicleId ? "offline" : "online",
            enabledFeatures:
              payload.enabledFeatures.length > 0
                ? payload.enabledFeatures
                : ["GPS Tracking", "Live Location", "Motion Wake", "Smart Sleep Mode"],
            batteryLevel: 100,
            lastSeen: "Not assigned yet",
            notes: payload.notes || "Ready to be assigned and installed.",
            installDate: payload.installDate || "Install date not set",
            hardwareType: "ESP32 + SIM Tracker",
            photo: payload.photo,
            color: payload.color,
            deviceAssignment: payload.deviceAssignment ?? "Not assigned",
            location: { lat: location[0], lng: location[1], label: payload.name },
          };

          return {
            ...current,
            setupComplete: true,
            vehicles: [...current.vehicles, vehicle],
            trackerAssignmentVehicleId:
              current.vehicles.length === 0 && !current.trackerAssignmentVehicleId ? vehicle.id : current.trackerAssignmentVehicleId,
          };
        }),
      addDriver: (payload) =>
        setState((current) => ({
          ...current,
          drivers: [
            ...current.drivers,
            {
              id: `DRV-${String(current.drivers.length + 1).padStart(2, "0")}`,
              name: payload.name,
              phone: payload.phone,
              assignedVehicle: "Not assigned",
              assignedVehicleIds: [],
              status: "available",
              region: hasServiceArea ? serviceArea.label : "Not set",
              license: payload.license || "License not added",
              notes: payload.notes || "Added from company details.",
            },
          ],
        })),
      updateDriver: (id, updates) =>
        setState((current) => ({
          ...current,
          drivers: current.drivers.map((d) => d.id === id ? { ...d, ...updates } : d),
        })),
      removeDriver: (id) =>
        setState((current) => ({
          ...current,
          drivers: current.drivers.filter((d) => d.id !== id),
          vehicles: current.vehicles.map((v) => ({
            ...v,
            assignedDriverIds: (v.assignedDriverIds ?? []).filter((dId) => dId !== id),
          })),
        })),
      assignTrackerToVehicle: (vehicleId, trackerId) =>
        setState((current) => ({
          ...current,
          trackerAssignmentVehicleId: vehicleId,
          vehicles: current.vehicles.map((vehicle) => ({
            ...vehicle,
            deviceAssignment:
              vehicle.id === vehicleId
                ? trackerId
                : vehicle.deviceAssignment === trackerId
                ? "Not assigned"
                : vehicle.deviceAssignment,
            gpsOnline: vehicle.id === vehicleId ? true : vehicle.gpsOnline,
            deviceStatus: vehicle.id === vehicleId ? "online" : vehicle.deviceStatus,
            lastSeen: vehicle.id === vehicleId ? "Connected now" : vehicle.lastSeen,
          })),
        })),
      addAdmin: (payload) => {
        // Pre-register the invite so they join this org on signup
        if (user) {
          getOrCreateOrg(user.id, user.email).then((orgId) => {
            if (!orgId) return;
            supabase.from("org_invites").upsert({
              org_id: orgId,
              email: payload.email.trim().toLowerCase(),
              role: "admin",
            }, { onConflict: "org_id,email" }).then(() => {});
          });
        }
        setState((current) => ({
          ...current,
          admins: [
            ...current.admins,
            {
              id: `admin-${Date.now()}`,
              name: payload.name || payload.email,
              email: payload.email,
              alertTypes: payload.alertTypes,
            },
          ],
        }));
      },
      removeAdmin: (adminId) => {
        const admin = state.admins.find((a) => a.id === adminId);
        if (admin && user) {
          const removeFromOrg = async () => {
            const orgId = await getOrCreateOrg(user.id, user.email);
            if (!orgId) return;
            await supabase.from("organization_members")
              .delete()
              .eq("org_id", orgId)
              .eq("email", admin.email.trim().toLowerCase());
          };
          removeFromOrg();
        }
        setState((current) => ({
          ...current,
          admins: current.admins.filter((a) => a.id !== adminId),
        }));
      },
      updateAdmin: (adminId, updates) =>
        setState((current) => ({
          ...current,
          admins: current.admins.map((a) =>
            a.id === adminId ? { ...a, ...updates } : a,
          ),
        })),
      updateAdminAlerts: (adminId, alertTypes) =>
        setState((current) => ({
          ...current,
          admins: current.admins.map((a) =>
            a.id === adminId ? { ...a, alertTypes } : a,
          ),
        })),
      updateTrackingProfile: (profile) =>
        setState((current) => ({
          ...current,
          trackingProfile: { ...(current.trackingProfile ?? defaultTrackingProfile), ...profile },
        })),
      addMaintenanceItem: (item) =>
        setState((current) => ({
          ...current,
          maintenanceItems: [
            ...current.maintenanceItems,
            { ...item, id: `maint-${Date.now()}` },
          ],
        })),
      updateMaintenanceItem: (id, updates) =>
        setState((current) => ({
          ...current,
          maintenanceItems: current.maintenanceItems.map((m) =>
            m.id === id ? { ...m, ...updates } : m,
          ),
        })),
      removeMaintenanceItem: (id) =>
        setState((current) => ({
          ...current,
          maintenanceItems: current.maintenanceItems.filter((m) => m.id !== id),
        })),
      addGeofence: (item) =>
        setState((current) => ({
          ...current,
          geofences: [...(current.geofences ?? []), { ...item, id: `geo-${Date.now()}` }],
        })),
      updateGeofence: (id, updates) =>
        setState((current) => ({
          ...current,
          geofences: (current.geofences ?? []).map((g) => (g.id === id ? { ...g, ...updates } : g)),
        })),
      removeGeofence: (id) =>
        setState((current) => ({
          ...current,
          geofences: (current.geofences ?? []).filter((g) => g.id !== id),
        })),
      updateTimezone: (tz) => setState((current) => ({ ...current, timezone: tz })),
      addWifiShortcut: (item) =>
        setState((current) => ({
          ...current,
          wifiShortcuts: [
            ...(current.wifiShortcuts ?? []),
            { ...item, id: `wifi-${Date.now()}` },
          ],
        })),
      removeWifiShortcut: (id) =>
        setState((current) => ({
          ...current,
          wifiShortcuts: (current.wifiShortcuts ?? []).filter((s) => s.id !== id),
        })),
      updateVehicle: (id, updates) =>
        setState((current) => ({
          ...current,
          vehicles: current.vehicles.map((v) => (v.id === id ? { ...v, ...updates } : v)),
        })),
      removeVehicle: (id) =>
        setState((current) => ({
          ...current,
          vehicles: current.vehicles.filter((v) => v.id !== id),
          maintenanceItems: current.maintenanceItems.filter((m) => m.vehicleId !== id),
        })),
      assignDriverToVehicle: (vehicleId, driverId) =>
        setState((current) => ({
          ...current,
          vehicles: current.vehicles.map((v) =>
            v.id === vehicleId
              ? { ...v, assignedDriverIds: [...new Set([...(v.assignedDriverIds ?? []), driverId])] }
              : v,
          ),
          drivers: current.drivers.map((d) =>
            d.id === driverId
              ? { ...d, assignedVehicleIds: [...new Set([...(d.assignedVehicleIds ?? []), vehicleId])] }
              : d,
          ),
        })),
      removeDriverFromVehicle: (vehicleId, driverId) =>
        setState((current) => ({
          ...current,
          vehicles: current.vehicles.map((v) =>
            v.id === vehicleId
              ? { ...v, assignedDriverIds: (v.assignedDriverIds ?? []).filter((id) => id !== driverId) }
              : v,
          ),
          drivers: current.drivers.map((d) =>
            d.id === driverId
              ? { ...d, assignedVehicleIds: (d.assignedVehicleIds ?? []).filter((id) => id !== vehicleId) }
              : d,
          ),
        })),
    }),
    [hasServiceArea, notifications, serviceArea, serverSynced, forceSyncToServer, state, userRole, driverVehicleId, liveTrackers],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used inside WorkspaceProvider");
  }
  return context;
}
