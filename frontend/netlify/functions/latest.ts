import type { Config, Context } from "@netlify/functions";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

function getUserInfo(req: Request): { userId: string; email: string } | null {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const payload = auth.slice(7).split(".")[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { sub?: string; email?: string };
    if (!decoded.sub) return null;
    return { userId: decoded.sub, email: (decoded.email ?? "").toLowerCase() };
  } catch {
    return null;
  }
}

export default async (req: Request, context: Context) => {
  const userInfo = getUserInfo(req);
  if (!userInfo) return json({ ok: false, error: "unauthorized" }, 401);

  const { getStore } = await import("@netlify/blobs");

  // Find which device IDs belong to this user's workspace (or their org owner's).
  const wsStore = getStore({ name: "fleet-workspaces", consistency: "strong" });

  let workspaceOwner = userInfo.userId;
  if (userInfo.email) {
    const membership = await wsStore.get(`member/${userInfo.email}`, { type: "json" }) as { orgOwner: string } | null;
    if (membership?.orgOwner) workspaceOwner = membership.orgOwner;
  }

  const ws = await wsStore.get(`workspace/${workspaceOwner}`, { type: "json" }) as {
    vehicles?: { id: string; deviceAssignment?: string }[];
  } | null;

  const ownedIds = new Set(
    (ws?.vehicles ?? [])
      .map((v) => v.deviceAssignment)
      .filter((id): id is string => Boolean(id)),
  );

  if (ownedIds.size === 0) {
    return json({ ok: true, devices: {} });
  }

  const store = getStore({ name: "fleet-telemetry", consistency: "strong" });
  const devices: Record<string, unknown> = {};

  for (const deviceId of ownedIds) {
    const record = await store.get(`latest/${deviceId}`, { type: "json" });
    if (record && typeof record === "object") {
      const lastGps = await store.get(`last_gps/${deviceId}`, { type: "json" });
      devices[deviceId] = lastGps ? { ...record, last_gps: lastGps } : record;
    }
  }

  return json({ ok: true, devices });
};

export const config: Config = {
  path: "/api/fleet/latest",
  method: ["GET"],
};
