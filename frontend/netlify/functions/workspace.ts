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

// Mobile and web now share one workspace: Supabase organizations.workspace_blob.
// (Previously this endpoint used Netlify Blobs, a separate store the web app
// never wrote to, so the mobile app saw no vehicles.)
export default async (req: Request, _context: Context) => {
  const userInfo = getUserInfo(req);
  if (!userInfo) return json({ ok: false, error: "unauthorized" }, 401);

  const db = supabase();

  // Resolve the user's org — oldest membership, consistent with latest.ts / team.ts.
  const { data: members } = await db
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userInfo.userId)
    .order("created_at", { ascending: true })
    .limit(1);
  const orgId = members?.[0]?.org_id ?? null;
  if (!orgId) return json({ ok: true, workspace: null });

  if (req.method === "GET") {
    const { data: org } = await db
      .from("organizations")
      .select("workspace_blob")
      .eq("id", orgId)
      .maybeSingle();
    return json({ ok: true, workspace: org?.workspace_blob ?? null });
  }

  if (req.method === "POST") {
    try {
      const body = await req.json() as Record<string, unknown>;

      const { data: org } = await db
        .from("organizations")
        .select("workspace_blob")
        .eq("id", orgId)
        .maybeSingle();
      const existing = (org?.workspace_blob as Record<string, unknown> | null) ?? null;

      if (existing) {
        const serverSavedAt = (existing._savedAt as number) ?? 0;
        const clientSavedAt = (body._savedAt as number) ?? 0;
        if (serverSavedAt > clientSavedAt) {
          // Server is newer — preserve its device assignments so a stale write
          // from an old tab/device never wipes tracker assignments.
          const serverVehicles = (existing.vehicles as Array<{ id: string; deviceAssignment?: string }>) ?? [];
          const serverAssignments = new Map(serverVehicles.map((v) => [v.id, v.deviceAssignment]));
          body.vehicles = ((body.vehicles as Array<{ id: string; deviceAssignment?: string }>) ?? []).map((v) => ({
            ...v,
            deviceAssignment: serverAssignments.get(v.id) ?? v.deviceAssignment,
          }));
        }
      }

      await db
        .from("organizations")
        .update({ workspace_blob: body, updated_at: new Date().toISOString() })
        .eq("id", orgId);
      return json({ ok: true });
    } catch {
      return json({ ok: false, error: "invalid body" }, 400);
    }
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/workspace",
  method: ["GET", "POST"],
};
