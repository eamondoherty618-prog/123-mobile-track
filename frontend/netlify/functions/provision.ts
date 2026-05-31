import type { Config, Context } from "@netlify/functions";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function getUserId(context: Context): string | null {
  const ctx = context.clientContext as { user?: { sub?: string } } | undefined;
  return ctx?.user?.sub ?? null;
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  // Route on the last path segment: /api/fleet/provision/<action>
  const action = url.pathname.split("/").pop();

  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name: "fleet-provision", consistency: "strong" });

  // ── POST /api/fleet/provision/init ───────────────────────────────────────
  // Tracker calls this on boot when unclaimed. Registers the hardware ID as
  // pending so the app can discover and claim it.
  if (action === "init" && req.method === "POST") {
    const body = await req.json().catch(() => null);
    const hw = String(body?.hardware_id ?? "").trim();
    if (!hw) return json({ ok: false, error: "hardware_id required" }, 400);

    // Check if already claimed — return existing credentials so a reflash works.
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
  // Tracker polls this while in provisioning mode waiting to be claimed.
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
  // App calls this (authenticated) to claim a pending device, generate its
  // unique credentials, and link it to the user's workspace.
  if (action === "claim" && req.method === "POST") {
    const userId = getUserId(context);
    if (!userId) return json({ ok: false, error: "unauthorized" }, 401);

    const body = await req.json().catch(() => null);
    const hw = String(body?.hardware_id ?? "").trim();
    const deviceName = String(body?.device_name ?? "").trim() || `tracker-${hw.slice(-4)}`;
    const existingVehicleId = String(body?.vehicle_id ?? "").trim();
    if (!hw) return json({ ok: false, error: "hardware_id required" }, 400);

    // Idempotent — return existing claim if already done.
    const existing = await store.get(`claimed/${hw}`, { type: "json" }) as {
      device_id: string; api_key: string; claimed_by: string;
    } | null;
    if (existing) {
      if (existing.claimed_by !== userId) {
        return json({ ok: false, error: "already claimed by another account" }, 409);
      }
      return json({ ok: true, device_id: existing.device_id, already_claimed: true });
    }

    const deviceId = `tracker-${randomHex(3)}`;
    const apiKey = randomHex(24);
    const claimRecord = {
      device_id: deviceId,
      api_key: apiKey,
      hardware_id: hw,
      device_name: deviceName,
      claimed_by: userId,
      claimed_at: new Date().toISOString(),
    };

    await store.setJSON(`claimed/${hw}`, claimRecord);

    // Assign to existing vehicle if requested, otherwise create a new one.
    const wsStore = getStore({ name: "fleet-workspaces", consistency: "strong" });
    const wsKey = `workspace/${userId}`;
    const ws = (await wsStore.get(wsKey, { type: "json" }) ?? { vehicles: [], geofences: [] }) as {
      vehicles: { id: string; name: string; deviceAssignment?: string }[];
      geofences: unknown[];
    };

    const target = existingVehicleId
      ? ws.vehicles.find((v) => v.id === existingVehicleId && !v.deviceAssignment)
      : null;

    if (target) {
      target.deviceAssignment = deviceId;
    } else {
      ws.vehicles.push({
        id: `vehicle-${randomHex(4)}`,
        name: deviceName,
        deviceAssignment: deviceId,
      });
    }
    await wsStore.setJSON(wsKey, ws);

    // Persist a telemetry API-key record so the telemetry function can validate it.
    const keyStore = getStore({ name: "fleet-keys", consistency: "strong" });
    await keyStore.setJSON(`key/${apiKey}`, { device_id: deviceId, owner: userId });

    return json({ ok: true, device_id: deviceId });
  }

  // ── GET /api/fleet/provision/pending ─────────────────────────────────────
  // App calls this (authenticated) to list devices broadcasting for claim.
  if (action === "pending" && req.method === "GET") {
    const userId = getUserId(context);
    if (!userId) return json({ ok: false, error: "unauthorized" }, 401);

    const { blobs } = await store.list({ prefix: "pending/" });
    const cutoff = Date.now() - 10 * 60 * 1000; // only show last 10 min
    const pending = (
      await Promise.all(
        blobs.map((b) => store.get(b.key, { type: "json" }) as Promise<{ hardware_id: string; created_at: string } | null>)
      )
    ).filter((r): r is { hardware_id: string; created_at: string } =>
      r !== null && new Date(r.created_at).getTime() > cutoff
    );

    return json({ ok: true, pending });
  }

  return new Response("Not found", { status: 404 });
};

export const config: Config = {
  path: "/api/fleet/provision/:action",
  method: ["GET", "POST"],
};
