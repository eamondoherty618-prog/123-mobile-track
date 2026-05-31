import type { Config } from "@netlify/functions";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export default async (req: Request) => {
  const url = new URL(req.url);
  const deviceId = url.searchParams.get("device_id") ?? "";
  if (!deviceId) return json({ ok: false, error: "device_id required" }, 400);

  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name: "fleet-telemetry", consistency: "strong" });

  const { blobs } = await store.list({ prefix: `device-alerts/${deviceId}/` });
  const recent = blobs.slice(-200);
  const alerts = (await Promise.all(
    recent.map((b) => store.get(b.key, { type: "json" }))
  )).filter(Boolean);

  alerts.sort((a: unknown, b: unknown) => {
    const ta = (a as { time: string }).time;
    const tb = (b as { time: string }).time;
    return new Date(tb).getTime() - new Date(ta).getTime();
  });

  return json({ ok: true, alerts });
};

export const config: Config = {
  path: "/api/fleet/alerts",
  method: ["GET"],
};
