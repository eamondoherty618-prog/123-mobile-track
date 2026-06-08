import type { Config, Context } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";

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
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { sub?: string; email?: string };
    if (!decoded.sub) return null;
    return { userId: decoded.sub, email: (decoded.email ?? "").toLowerCase() };
  } catch {
    return null;
  }
}

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { realtime: { transport: ws } },
  );
}

export default async (req: Request, context: Context) => {
  const userInfo = getUserInfo(req);
  if (!userInfo) return json({ ok: false, error: "unauthorized" }, 401);

  const db = supabase();

  // Look up the user's org from organization_members (same lookup as the frontend workspace).
  const { data: members } = await db
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userInfo.userId)
    .limit(1);
  const membership = members?.[0] ?? null;

  if (!membership?.org_id) return json({ ok: true, devices: {} });

  // Get the workspace blob from Supabase organizations table.
  const { data: org } = await db
    .from("organizations")
    .select("workspace_blob")
    .eq("id", membership.org_id)
    .maybeSingle();

  const workspaceBlob = org?.workspace_blob as {
    vehicles?: { id: string; deviceAssignment?: string }[];
  } | null;

  const ownedIds = new Set(
    (workspaceBlob?.vehicles ?? [])
      .map((v) => v.deviceAssignment)
      .filter((id): id is string => Boolean(id) && id !== "Not assigned"),
  );

  if (ownedIds.size === 0) return json({ ok: true, devices: {} });

  // Fetch live telemetry for all owned devices using the service role key (bypasses RLS).
  const { data: rows } = await db
    .from("telemetry_latest")
    .select("*")
    .in("device_id", Array.from(ownedIds));

  const devices: Record<string, unknown> = {};
  for (const row of rows ?? []) {
    const id = row.device_id as string;
    const hasLastGps = row.last_lat != null && row.last_lon != null;
    devices[id] = {
      ...row,
      gps: row.lat != null ? { lat: row.lat, lon: row.lon, speed_kph: row.speed_kph, timestamp: row.gps_timestamp } : undefined,
      last_gps: hasLastGps ? { lat: row.last_lat, lon: row.last_lon, time: row.received_at } : undefined,
    };
  }

  return json({ ok: true, devices });
};

export const config: Config = {
  path: "/api/fleet/latest",
  method: ["GET"],
};
