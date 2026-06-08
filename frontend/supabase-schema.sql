-- 123 Mobile Track — Supabase schema
-- Run this in Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Organizations ────────────────────────────────────────────────────────────
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL DEFAULT '123 Mobile Track',
  service_area_id TEXT DEFAULT '',
  timezone TEXT DEFAULT 'America/New_York',
  admin_name TEXT DEFAULT '',
  admin_email TEXT DEFAULT '',
  setup_complete BOOLEAN DEFAULT FALSE,
  tracker_assignment_vehicle_id TEXT DEFAULT '',
  workspace_blob JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Organization members ─────────────────────────────────────────────────────
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member', -- 'owner' | 'admin' | 'member'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

-- ─── Vehicles ─────────────────────────────────────────────────────────────────
CREATE TABLE vehicles (
  id TEXT PRIMARY KEY,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  vehicle_number TEXT DEFAULT '',
  plate TEXT DEFAULT '',
  make TEXT DEFAULT '',
  model TEXT DEFAULT '',
  year INTEGER DEFAULT 2024,
  type TEXT DEFAULT 'Van',
  notes TEXT DEFAULT '',
  install_date TEXT DEFAULT '',
  device_assignment TEXT DEFAULT '',
  photo TEXT DEFAULT '',
  enabled_features TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Drivers ──────────────────────────────────────────────────────────────────
CREATE TABLE drivers (
  id TEXT PRIMARY KEY,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  license_number TEXT DEFAULT '',
  license_class TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  assigned_vehicle_id TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  avatar TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Telemetry (latest packet per device) ─────────────────────────────────────
CREATE TABLE telemetry_latest (
  device_id TEXT PRIMARY KEY,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  has_fix BOOLEAN,
  fix_source TEXT,
  battery_mv INTEGER,
  cell_rssi INTEGER,
  firmware TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  speed_kph DOUBLE PRECISION,
  gps_timestamp TIMESTAMPTZ,
  last_lat DOUBLE PRECISION,
  last_lon DOUBLE PRECISION,
  motion_state TEXT,
  queued_messages INTEGER,
  stopped_since TIMESTAMPTZ,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  raw JSONB
);

-- ─── Trips ────────────────────────────────────────────────────────────────────
CREATE TABLE trips (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_s INTEGER,
  distance_km DOUBLE PRECISION,
  max_speed_kph DOUBLE PRECISION,
  avg_speed_kph DOUBLE PRECISION,
  point_count INTEGER DEFAULT 0,
  event_count INTEGER DEFAULT 0,
  events JSONB DEFAULT '[]',
  start_lat DOUBLE PRECISION,
  start_lon DOUBLE PRECISION,
  end_lat DOUBLE PRECISION,
  end_lon DOUBLE PRECISION,
  route JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX trips_device_time ON trips(device_id, start_time DESC);

-- ─── Alerts ───────────────────────────────────────────────────────────────────
CREATE TABLE alerts (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  type TEXT,
  title TEXT,
  severity TEXT DEFAULT 'info',
  time TIMESTAMPTZ,
  speed_kph DOUBLE PRECISION,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX alerts_device_time ON alerts(device_id, time DESC);

-- ─── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_latest ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Members can see their own memberships
CREATE POLICY "members_own" ON organization_members FOR ALL
  USING (user_id = auth.uid());

-- Any authenticated user can create an org; members can read/update/delete their own
CREATE POLICY "orgs_insert" ON organizations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "orgs_select_update_delete" ON organizations FOR SELECT
  USING (id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));
CREATE POLICY "orgs_update" ON organizations FOR UPDATE
  USING (id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));
CREATE POLICY "orgs_delete" ON organizations FOR DELETE
  USING (id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "vehicles_org" ON vehicles FOR ALL
  USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "drivers_org" ON drivers FOR ALL
  USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "telemetry_org" ON telemetry_latest FOR ALL
  USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "trips_org" ON trips FOR ALL
  USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "alerts_org" ON alerts FOR ALL
  USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));
