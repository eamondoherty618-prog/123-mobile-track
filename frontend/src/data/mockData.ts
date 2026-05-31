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
    name: "Live GPS Tracking",
    description: "Real-time vehicle location on the fleet map, updating every 15 seconds via cellular tracker.",
    category: "active",
    statusLabel: "Active",
  },
  {
    id: "FEAT-2",
    name: "Trip History",
    description: "Every drive is automatically recorded with route, duration, distance, and max speed.",
    category: "active",
    statusLabel: "Active",
  },
  {
    id: "FEAT-3",
    name: "Trip Replay",
    description: "Scrub through any trip on an interactive map with a playback timeline and speed readout.",
    category: "active",
    statusLabel: "Active",
  },
  {
    id: "FEAT-4",
    name: "Driving Alerts",
    description: "Hard brake, rapid acceleration, and speeding events flagged in real time.",
    category: "active",
    statusLabel: "Active",
  },
  {
    id: "FEAT-5",
    name: "Geofences",
    description: "Draw zones around job sites and depots. Get notified when vehicles enter or leave.",
    category: "active",
    statusLabel: "Active",
  },
  {
    id: "FEAT-6",
    name: "Maintenance Reminders",
    description: "Track oil changes, inspections, and any custom service intervals with due-date alerts.",
    category: "active",
    statusLabel: "Active",
  },
  {
    id: "FEAT-7",
    name: "Driver Management",
    description: "Assign drivers to vehicles and view per-driver scorecards ranked by events per 100 miles.",
    category: "active",
    statusLabel: "Active",
  },
  {
    id: "FEAT-8",
    name: "Multi-Tracker Fleet",
    description: "Unlimited trackers on one account. Each device auto-appears when it checks in.",
    category: "active",
    statusLabel: "Active",
  },
  {
    id: "FEAT-9",
    name: "Smart Sleep Mode",
    description: "Motion-triggered wake, overnight deep sleep, and configurable heartbeat keep battery consumption low.",
    category: "active",
    statusLabel: "Active",
  },
  {
    id: "FEAT-10",
    name: "CSV Export",
    description: "Download trips and alerts as CSV files for reporting, payroll, or insurance documentation.",
    category: "active",
    statusLabel: "Active",
  },
  {
    id: "FEAT-11",
    name: "Web Push Notifications",
    description: "Receive browser push alerts for hard brakes, speeding, and geofence triggers.",
    category: "beta",
    statusLabel: "Beta",
  },
  {
    id: "FEAT-12",
    name: "Ignition Sense",
    description: "Wired ignition input for instant on/off trip detection without motion-timer delays.",
    category: "hardware",
    statusLabel: "Hardware Add-on",
  },
  {
    id: "FEAT-13",
    name: "Dash Cam Integration",
    description: "Event-linked video clips synced to trips and alert timestamps.",
    category: "comingSoon",
    statusLabel: "Planned",
  },
  {
    id: "FEAT-14",
    name: "Fuel Tracking",
    description: "CAN bus or OBD-II fuel level monitoring with consumption reports.",
    category: "hardware",
    statusLabel: "Hardware Add-on",
  },
  {
    id: "FEAT-15",
    name: "iOS & Android App",
    description: "Native mobile app with push notifications and offline map caching.",
    category: "comingSoon",
    statusLabel: "Planned",
  },
];

export const kpis: KPIStat[] = [];
