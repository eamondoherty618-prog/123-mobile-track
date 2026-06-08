import type { Config } from "@netlify/functions";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function getUserInfo(req: Request): { userId: string; email: string } | null {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const payload = auth.slice(7).split(".")[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as {
      sub?: string;
      email?: string;
    };
    if (!decoded.sub) return null;
    return { userId: decoded.sub, email: (decoded.email ?? "").toLowerCase() };
  } catch {
    return null;
  }
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

type Vehicle = { id: string; name: string; deviceAssignment?: string; [key: string]: unknown };

// Find the workspace key for this user, respecting org membership.
async function resolveWorkspaceKey(
  wsStore: Awaited<ReturnType<typeof import("@netlify/blobs")["getStore"]>>,
  userId: string,
  email: string,
): Promise<string> {
  if (email) {
    const membership = await wsStore.get(`member/${email}`, { type: "json" }) as { orgOwner: string } | null;
    if (membership?.orgOwner) return `workspace/${membership.orgOwner}`;
  }
  return `workspace/${userId}`;
}

// Store device→user reverse lookup so telemetry.ts can resolve the workspace owner.
async function storeDeviceUserLookup(
  store: Awaited<ReturnType<typeof import("@netlify/blobs")["getStore"]>>,
  deviceId: string,
  userId: string,
  email: string,
) {
  await store.setJSON(`device-to-user/${deviceId}`, { userId, email });
}

// Write the device assignment into the workspace blob.
async function assignDeviceToWorkspace(
  wsStore: Awaited<ReturnType<typeof import("@netlify/blobs")["getStore"]>>,
  wsKey: string,
  deviceId: string,
  vehicleId: string | null,
  deviceName: string,
) {
  const workspace = await wsStore.get(wsKey, { type: "json" }) as Record<string, unknown> | null;
  const vehicles: Vehicle[] = (workspace?.vehicles as Vehicle[]) ?? [];

  let updatedVehicles: Vehicle[];
  if (vehicleId) {
    // Assign tracker to an existing vehicle.
    updatedVehicles = vehicles.map((v) =>
      v.id === vehicleId ? { ...v, deviceAssignment: deviceId } : v,
    );
    // If the vehicle wasn't found (stale id), add a new one anyway.
    if (!vehicles.find((v) => v.id === vehicleId)) {
      updatedVehicles.push({ id: vehicleId, name: deviceName, deviceAssignment: deviceId });
    }
  } else {
    // Create a new vehicle entry for this tracker.
    const alreadyLinked = vehicles.some((v) => v.deviceAssignment === deviceId);
    if (!alreadyLinked) {
      updatedVehicles = [
        ...vehicles,
        { id: `vehicle-${randomHex(4)}`, name: deviceName, deviceAssignment: deviceId },
      ];
    } else {
      updatedVehicles = vehicles;
    }
  }

  await wsStore.setJSON(wsKey, {
    ...(workspace ?? {}),
    vehicles: updatedVehicles,
    _savedAt: Date.now(),
  });
}

export default async (req: Request) => {
  const url = new URL(req.url);
  const action = url.pathname.split("/").pop();

  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name: "fleet-provision", consistency: "strong" });

  // ── POST /api/fleet/provision/init ───────────────────────────────────────
  if (action === "init" && req.method === "POST") {
    const body = await req.json().catch(() => null);
    const hw = String(body?.hardware_id ?? "").trim();
    if (!hw) return json({ ok: false, error: "hardware_id required" }, 400);

    const existing = await store.get(`claimed/${hw}`, { type: "json" }) as {
      device_id: string; api_key: string;
    } | null;
    if (existing) {
      return json({ ok: true, already_claimed: true, device_id: existing.device_id, api_key: existing.api_key });
    }

    await store.setJSON(`pending/${hw}`, { hardware_id: hw, created_at: new Date().toISOString() });
    return json({ ok: true, pending: true });
  }

  // ── GET /api/fleet/provision/poll ────────────────────────────────────────
  if (action === "poll" && req.method === "GET") {
    const hw = url.searchParams.get("hw") ?? "";
    if (!hw) return json({ ok: false, error: "hw required" }, 400);

    const claimed = await store.get(`claimed/${hw}`, { type: "json" }) as {
      device_id: string; api_key: string;
    } | null;

    if (claimed) {
      return json({ ok: true, claimed: true, device_id: claimed.device_id, api_key: claimed.api_key });
    }
    return json({ ok: true, claimed: false });
  }

  // ── POST /api/fleet/provision/claim ──────────────────────────────────────
  if (action === "claim" && req.method === "POST") {
    const userInfo = getUserInfo(req);
    if (!userInfo) return json({ ok: false, error: "unauthorized" }, 401);
    const { userId, email } = userInfo;

    const body = await req.json().catch(() => null);
    const hw = String(body?.hardware_id ?? "").trim();
    const deviceName = String(body?.device_name ?? "").trim() || `tracker-${hw.slice(-4)}`;
    const vehicleId = String(body?.vehicle_id ?? "").trim() || null;
    if (!hw) return json({ ok: false, error: "hardware_id required" }, 400);

    const wsStore = getStore({ name: "fleet-workspaces", consistency: "strong" });
    const wsKey = await resolveWorkspaceKey(wsStore, userId, email);

    // Idempotent — if already claimed by this user, still ensure workspace is updated.
    const existing = await store.get(`claimed/${hw}`, { type: "json" }) as {
      device_id: string; api_key: string; claimed_by: string; device_name: string;
    } | null;
    if (existing) {
      if (existing.claimed_by !== userId) {
        return json({ ok: false, error: "already claimed by another account" }, 409);
      }
      // Make sure the workspace reflects this assignment (fixes previously-broken claims).
      await assignDeviceToWorkspace(wsStore, wsKey, existing.device_id, vehicleId, existing.device_name ?? deviceName);
      await storeDeviceUserLookup(store, existing.device_id, userId, email);
      return json({ ok: true, device_id: existing.device_id, already_claimed: true });
    }

    const deviceId = `tracker-${randomHex(3)}`;
    const apiKey = randomHex(24);
    await store.setJSON(`claimed/${hw}`, {
      device_id: deviceId,
      api_key: apiKey,
      hardware_id: hw,
      device_name: deviceName,
      claimed_by: userId,
      claimed_at: new Date().toISOString(),
    });

    // Remove from pending now that it's claimed.
    await store.delete(`pending/${hw}`).catch(() => null);

    // Write device assignment into the workspace and store reverse lookup.
    await assignDeviceToWorkspace(wsStore, wsKey, deviceId, vehicleId, deviceName);
    await storeDeviceUserLookup(store, deviceId, userId, email);

    return json({ ok: true, device_id: deviceId });
  }

  // ── GET /api/fleet/provision/pending ─────────────────────────────────────
  if (action === "pending" && req.method === "GET") {
    const userInfo = getUserInfo(req);
    if (!userInfo) return json({ ok: false, error: "unauthorized" }, 401);

    const { blobs } = await store.list({ prefix: "pending/" });
    const cutoff = Date.now() - 10 * 60 * 1000;
    const pending = (
      await Promise.all(
        blobs.map((b) => store.get(b.key, { type: "json" }) as Promise<{ hardware_id: string; created_at: string } | null>)
      )
    ).filter((r): r is { hardware_id: string; created_at: string } =>
      r !== null && new Date(r.created_at).getTime() > cutoff
    );

    return json({ ok: true, pending });
  }

  // ── POST /api/fleet/provision/repair ─────────────────────────────────────
  // Re-syncs all previously claimed devices for this user into the workspace.
  // Fixes trackers that were claimed before the workspace-write bug was patched.
  if (action === "repair" && req.method === "POST") {
    const userInfo = getUserInfo(req);
    if (!userInfo) return json({ ok: false, error: "unauthorized" }, 401);
    const { userId, email } = userInfo;

    const { blobs } = await store.list({ prefix: "claimed/" });
    const wsStore = getStore({ name: "fleet-workspaces", consistency: "strong" });
    const wsKey = await resolveWorkspaceKey(wsStore, userId, email);

    let fixed = 0;
    await Promise.all(
      blobs.map(async (b) => {
        const record = await store.get(b.key, { type: "json" }) as {
          device_id: string; device_name: string; claimed_by: string;
        } | null;
        if (!record || record.claimed_by !== userId) return;
        await assignDeviceToWorkspace(wsStore, wsKey, record.device_id, null, record.device_name);
        await storeDeviceUserLookup(store, record.device_id, userId, email);
        fixed++;
      }),
    );

    return json({ ok: true, fixed });
  }

  return new Response("Not found", { status: 404 });
};

export const config: Config = {
  path: "/api/fleet/provision/:action",
  method: ["GET", "POST"],
};
