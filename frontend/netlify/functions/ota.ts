import type { Config } from "@netlify/functions";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function getUserId(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const payload = auth.slice(7).split(".")[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return decoded.sub ?? null;
  } catch { return null; }
}

type OtaMetadata = { version: string; size: number; uploaded_at: string };

export default async (req: Request) => {
  const url = new URL(req.url);
  const action = url.pathname.split("/").pop();

  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name: "fleet-ota", consistency: "strong" });

  // ── GET /api/fleet/ota/check ──────────────────────────────────────────────
  // Tracker calls this (or telemetry response includes it) to learn if a newer
  // firmware is available. Returns version + size so tracker can allocate space.
  if (action === "check" && req.method === "GET") {
    const current = url.searchParams.get("version") ?? "0.0.0";
    const latest = await store.get("latest", { type: "json" }) as OtaMetadata | null;
    if (!latest) return json({ available: false });

    const available = latest.version !== current && semverGt(latest.version, current);
    return json({ available, version: latest.version, size: latest.size });
  }

  // ── GET /api/fleet/ota/firmware ───────────────────────────────────────────
  // Returns the raw firmware binary for the requested version.
  if (action === "firmware" && req.method === "GET") {
    const version = url.searchParams.get("version");
    if (!version) return json({ error: "version required" }, 400);

    const firmwareBuf = await store.get(`firmware/v${version}.bin`, { type: "arrayBuffer" });
    if (!firmwareBuf) return json({ error: "not found" }, 404);

    return new Response(firmwareBuf, {
      headers: {
        "content-type": "application/octet-stream",
        "content-length": String(firmwareBuf.byteLength),
        "cache-control": "no-store",
      },
    });
  }

  // ── POST /api/fleet/ota/upload ────────────────────────────────────────────
  // Authenticated upload of a new firmware binary. Sets it as the latest version
  // so all managed trackers will be offered the update on next check-in.
  if (action === "upload" && req.method === "POST") {
    if (!getUserId(req)) return json({ error: "unauthorized" }, 401);

    const version = url.searchParams.get("version");
    if (!version) return json({ error: "version query param required" }, 400);

    const binaryData = await req.arrayBuffer();
    if (!binaryData.byteLength) return json({ error: "empty body" }, 400);

    await store.set(`firmware/v${version}.bin`, binaryData);
    const meta: OtaMetadata = {
      version,
      size: binaryData.byteLength,
      uploaded_at: new Date().toISOString(),
    };
    await store.setJSON("latest", meta);

    return json({ ok: true, version, size: binaryData.byteLength });
  }

  // ── GET /api/fleet/ota/latest ─────────────────────────────────────────────
  // App calls this to show the current latest firmware version in the UI.
  if (action === "latest" && req.method === "GET") {
    const latest = await store.get("latest", { type: "json" }) as OtaMetadata | null;
    return json({ ok: true, latest: latest ?? null });
  }

  // ── GET /api/fleet/ota/trackers ───────────────────────────────────────────
  // Returns deployed firmware version + per-tracker firmware versions from telemetry.
  if (action === "trackers" && req.method === "GET") {
    const userId = getUserId(req);
    if (!userId) return json({ error: "unauthorized" }, 401);

    const auth = req.headers.get("authorization")!;
    const jwtPayload = JSON.parse(atob(auth.slice(7).split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as { email?: string };
    const email = (jwtPayload.email ?? "").toLowerCase();

    const wsStore = getStore({ name: "fleet-workspaces", consistency: "strong" });
    let wsKey = `workspace/${userId}`;
    if (email) {
      const membership = await wsStore.get(`member/${email}`, { type: "json" }) as { orgOwner: string } | null;
      if (membership?.orgOwner) wsKey = `workspace/${membership.orgOwner}`;
    }
    const workspace = await wsStore.get(wsKey, { type: "json" }) as {
      vehicles?: { id: string; name: string; deviceAssignment?: string }[];
    } | null;

    const vehicles = (workspace?.vehicles ?? []).filter(
      (v) => v.deviceAssignment && v.deviceAssignment !== "Not assigned",
    );

    type TrackerInfo = { vehicleName: string; deviceId: string; firmware: string | null };
    const trackers: TrackerInfo[] = [];

    if (vehicles.length > 0) {
      const { createClient } = await import("@supabase/supabase-js");
      const { default: ws } = await import("ws");
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { realtime: { transport: ws } });
      const ids = vehicles.map((v) => v.deviceAssignment!);
      const { data } = await sb.from("telemetry_latest").select("device_id, payload").in("device_id", ids);
      for (const v of vehicles) {
        const row = data?.find((r) => r.device_id === v.deviceAssignment);
        const firmware = (row?.payload as Record<string, unknown> | null)?.firmware as string | null ?? null;
        trackers.push({ vehicleName: v.name, deviceId: v.deviceAssignment!, firmware });
      }
    }

    const latest = await store.get("latest", { type: "json" }) as OtaMetadata | null;
    return json({ ok: true, deployed: latest ?? null, trackers });
  }

  return new Response("Not found", { status: 404 });
};

// Simple semver greater-than: "0.6.0" > "0.5.0"
function semverGt(a: string, b: string): boolean {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return true;
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return false;
  }
  return false;
}

export const config: Config = {
  path: ["/api/fleet/ota/:action"],
  method: ["GET", "POST"],
};
