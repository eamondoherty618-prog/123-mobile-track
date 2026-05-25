# 123 Mobile Track — Frontend

Fleet tracking SaaS dashboard for service vehicles and mobile fleets. Built with Next.js 15, React 19, TypeScript, Tailwind CSS, and Leaflet. Deployed as a static site on Netlify with serverless functions for telemetry.

## Quick start

### Option A — Full stack (recommended)

Requires the [Netlify CLI](https://docs.netlify.com/cli/get-started/).

```bash
cd frontend
npm install
cp .env.local.example .env.local
# Edit .env.local: set NEXT_PUBLIC_API_BASE=http://localhost:8888
netlify dev
```

Opens at `http://localhost:8888`. The Next.js app and Netlify functions run together, so the live tracker card works end-to-end.

### Option B — Frontend only

```bash
cd frontend
npm install
npm run dev
```

Opens at `http://localhost:3000`. The live tracker card will show "Offline" because the Netlify functions aren't running, but everything else works.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_BASE` | Local dev only | Base URL for API calls. Empty string in production (same-origin on Netlify). Set to `http://localhost:8888` for `netlify dev`. |

Copy `.env.local.example` to `.env.local` and fill in the value for local development.

## Deployment (Netlify)

A `netlify.toml` at the repo root handles everything. Connect the repo in the Netlify UI and deploy — no manual build settings needed.

Build output goes to `frontend/out/`. Netlify functions live in `frontend/netlify/functions/`.

Set `NEXT_PUBLIC_API_BASE` to an empty string (or leave it unset) in Netlify environment variables — the functions are on the same origin in production.

## Live telemetry

The dashboard polls `/api/fleet/telemetry?device_id=tracker-001` every 15 seconds via `src/lib/liveTracker.ts`. Telemetry is stored in Netlify Blobs under the `fleet-telemetry` store.

To push a test payload to the live endpoint:

```bash
curl -X POST https://your-site.netlify.app/api/fleet/telemetry \
  -H "Content-Type: application/json" \
  -d '{"device_id":"tracker-001","battery_mv":3850,"cell_rssi":20,"has_fix":true,"gps":{"lat":40.7128,"lon":-74.006,"speed_kph":0},"motion_state":"stopped","firmware":"0.1.0"}'
```

## Project structure

```
src/
  app/            # Next.js App Router pages
  components/
    branding/     # Logo
    drawers/      # VehicleDetailDrawer, DeviceDetailDrawer
    filters/      # StickyFilterPanel (desktop sidebar), MobileFilterDrawer
    forms/        # AddVehicleModal, AddDriverModal, SetupWorkspaceModal
    layout/       # AppShell, SidebarNav, TopHeader
    map/          # Leaflet map (SSR-disabled)
    mobile/       # PWA install prompt + service worker
    tables/       # VehicleTable, DeviceTable, DriversTable, TripsTable
    ui/           # Button, Badge, SectionCard, KPIStatCard, EmptyState, ...
  data/
    mockData.ts   # Static seed data — featureModules only used in production;
                  # vehicles/devices/drivers/trips/alerts are dev references only
  lib/
    liveTracker.ts  # useLiveTracker hook (polls /api/fleet/telemetry every 15s)
    workspace.tsx   # WorkspaceProvider — localStorage-backed app state
    navigation.ts   # Sidebar link definitions
    utils.ts        # cn() helper
  types/
    index.ts      # Shared TypeScript interfaces

netlify/
  functions/
    telemetry.ts  # POST /api/fleet/telemetry — ingest device payload
                  # GET  /api/fleet/telemetry?device_id=X — fetch single device latest
    latest.ts     # GET  /api/fleet/latest — fetch all devices snapshot
```

## What is real vs pending

| Data | Status |
|---|---|
| Live GPS/telemetry (tracker-001) | Real — polled from Netlify Blobs every 15s |
| Vehicles/drivers added via UI | Persisted to localStorage |
| Feature modules list | Static in mockData.ts |
| Trips, alerts, geofences, maintenance | Empty states — real data pending |

## Roadmap

- [ ] Auth (Netlify Identity or JWT)
- [ ] Server-side vehicle/driver persistence (Netlify Blobs or Supabase)
- [ ] Trip recording from GPS track history
- [ ] Alert rules engine (speeding, idle, geofence, offline)
- [ ] SSE/WebSocket for sub-second live updates
- [ ] Role-based access, billing, reporting
