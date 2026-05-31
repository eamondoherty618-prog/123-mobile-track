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

type OtaMetadata = { version: string; size: number; uploaded_at: string };

export default async (req: Request, context: Context) => {
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
    if (!getUserId(context)) return json({ error: "unauthorized" }, 401);

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
  path: "/api/fleet/ota/:action",
  method: ["GET", "POST"],
};
