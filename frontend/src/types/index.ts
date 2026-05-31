export type VehicleStatus = "moving" | "idle" | "parked" | "offline";
export type DeviceSleepState = "awake" | "idle-watch" | "deep-sleep";
export type DeviceMotionState = "moving" | "stopped" | "vibration";
export type DeviceReportingProfile = "balanced" | "smart-sleep" | "high-frequency";
export type AlertSeverity = "critical" | "warning" | "info";
export type FeatureCategory = "active" | "beta" | "comingSoon" | "hardware";

export interface LocationPoint {
  lat: number;
  lng: number;
  label: string;
}

export interface VehicleAlertThresholds {
  speedingMph: number;       // 0 = disabled
  hardBrakeEnabled: boolean;
  rapidAccelEnabled: boolean;
  gpsOfflineMinutes: number; // 0 = disabled; fires when tracker reconnects after this gap
}

export interface Vehicle {
  id: string;
  name: string;
  vehicleNumber: string;
  plate: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  type: string;
  assignedDriver: string;       // legacy — use assignedDriverIds
  assignedDriverIds: string[];  // driver IDs
  region: string;
  status: VehicleStatus;
  gpsOnline: boolean;
  deviceStatus: "online" | "offline" | "needs-attention";
  enabledFeatures: string[];
  batteryLevel: number;
  lastSeen: string;
  notes: string;
  installDate: string;
  hardwareType: string;
  deviceAssignment: string;
  location: LocationPoint;
  photo?: string;
  color?: string;
  alertThresholds?: VehicleAlertThresholds;
}

export interface Device {
  id: string;
  assignedVehicleId: string;
  simNumber: string;
  firmwareVersion: string;
  batteryLevel: number;
  signalStrength: number;
  gpsLock: boolean;
  sleepState: DeviceSleepState;
  motionState: DeviceMotionState;
  movingUpdateInterval: string;
  stoppedUpdateInterval: string;
  idleTimeout: string;
  deepSleepTimeout: string;
  heartbeatInterval: string;
  reportingProfile: DeviceReportingProfile;
  lastPing: string;
  online: boolean;
  enabledFeatures: string[];
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  assignedVehicle: string;        // legacy — use assignedVehicleIds
  assignedVehicleIds: string[];   // vehicle IDs
  status: "on-route" | "available" | "off-duty";
  region: string;
  license: string;
  notes: string;
}

export interface Trip {
  id: string;
  vehicle: string;
  driver: string;
  startTime: string;
  endTime: string;
  distance: string;
  duration: string;
  region: string;
  status: "completed" | "active" | "review";
}

export interface FleetAlert {
  id: string;
  title: string;
  vehicle: string;
  type: string;
  severity: AlertSeverity;
  createdAt: string;
  detail: string;
}

export interface Geofence {
  id: string;
  name: string;
  lat: number;
  lon: number;
  radiusM: number;
  triggerOn: "enter" | "exit" | "both";
  alertEnabled: boolean;
  notes: string;
  vehicleIds?: string[];  // empty / undefined = applies to all vehicles
}

export type MaintenanceType =
  | "oil_change"
  | "tire_rotation"
  | "brakes"
  | "air_filter"
  | "battery"
  | "custom";

export interface MaintenanceItem {
  id: string;
  vehicleId: string;
  type: MaintenanceType;
  label: string;
  lastServiceDate: string;   // ISO date when last serviced
  intervalMiles: number;     // 0 = miles-based interval disabled
  intervalMonths: number;    // 0 = time-based interval disabled
  notes: string;
  alertEnabled: boolean;
}

export interface FeatureModule {
  id: string;
  name: string;
  description: string;
  category: FeatureCategory;
  statusLabel: string;
}

export interface KPIStat {
  label: string;
  value: string;
  delta: string;
  tone: "green" | "navy" | "amber" | "red";
}
