import {
  Device,
  Driver,
  FeatureModule,
  FleetAlert,
  Geofence,
  KPIStat,
  Trip,
  Vehicle,
} from "@/types";

export const featureCatalog = [
  "GPS Tracking",
  "Live Location",
  "Route History",
  "Geofencing",
  "Idle Alerts",
  "Speed Alerts",
  "Motion Wake",
  "Smart Sleep Mode",
  "Battery Monitoring",
  "Driver Assignment",
  "Maintenance Reminders",
  "Door Sensors",
  "Ignition Sense",
  "Tamper Alert",
  "Dash Cam",
  "Fuel Tracking",
  "Remote Lock/Unlock",
  "Custom Integration",
];

export const vehicles: Vehicle[] = [];

export const devices: Device[] = [];

export const drivers: Driver[] = [];

export const trips: Trip[] = [];

export const alerts: FleetAlert[] = [];

export const geofences: Geofence[] = [];

export const featureModules: FeatureModule[] = [
  {
    id: "FEAT-1",
    name: "GPS Tracking",
    description: "Baseline live location, route playback, and fleet heartbeat health.",
    category: "active",
    statusLabel: "Active",
  },
  {
    id: "FEAT-2",
    name: "Smart Sleep Mode",
    description: "Applies motion wake, overnight parked logic, and heartbeat scheduling.",
    category: "active",
    statusLabel: "Active",
  },
  {
    id: "FEAT-3",
    name: "Tamper Alert",
    description: "Flags unexpected movement, enclosure open events, and tracker disconnects.",
    category: "beta",
    statusLabel: "Beta",
  },
  {
    id: "FEAT-4",
    name: "Dash Cam",
    description: "Placeholder for future video workflows and evidence capture.",
    category: "comingSoon",
    statusLabel: "Coming Soon",
  },
  {
    id: "FEAT-5",
    name: "Fuel Tracking",
    description: "Reserved for CAN bus or external sensor integrations.",
    category: "hardware",
    statusLabel: "Hardware Dependent",
  },
  {
    id: "FEAT-6",
    name: "Remote Lock/Unlock",
    description: "Placeholder for partner integrations with service fleet immobilizers.",
    category: "comingSoon",
    statusLabel: "Coming Soon",
  },
];

export const kpis: KPIStat[] = [];
