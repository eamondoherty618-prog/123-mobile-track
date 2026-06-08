import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";

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
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { sub?: string };
    return decoded.sub ?? null;
  } catch {
    return null;
  }
}

export default async (req: Request) => {
  const userId = getUserId(req);
  if (!userId) return json({ ok: false, error: "unauthorized" }, 401);

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { realtime: { transport: ws } },
  );

  const { data: membership } = await sb
    .from("organization_members")
    .select("org_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (!membership?.org_id) return json({ ok: false, error: "no_org" }, 404);
  const { org_id: orgId, role: callerRole } = membership;

  if (req.method === "GET") {
    const [{ data: members }, { data: invites }] = await Promise.all([
      sb.from("organization_members").select("user_id, email, role, created_at").eq("org_id", orgId),
      sb.from("org_invites").select("email, role, created_at").eq("org_id", orgId),
    ]);

    const userIds = (members ?? []).map((m) => m.user_id).filter(Boolean) as string[];
    const authMeta: Record<string, { last_sign_in_at: string | null; full_name: string | null }> = {};

    if (userIds.length > 0) {
      const { data: { users } } = await sb.auth.admin.listUsers({ perPage: 1000 });
      for (const u of users ?? []) {
        if (userIds.includes(u.id)) {
          authMeta[u.id] = {
            last_sign_in_at: u.last_sign_in_at ?? null,
            full_name: (u.user_metadata?.full_name as string | undefined) ?? null,
          };
        }
      }
    }

    const enriched = (members ?? []).map((m) => ({
      user_id: m.user_id,
      email: m.email,
      role: m.role,
      created_at: m.created_at,
      full_name: authMeta[m.user_id]?.full_name ?? null,
      last_sign_in_at: authMeta[m.user_id]?.last_sign_in_at ?? null,
    }));

    return json({ ok: true, members: enriched, invites: invites ?? [], caller_role: callerRole });
  }

  if (callerRole !== "owner") return json({ ok: false, error: "forbidden" }, 403);

  if (req.method === "POST") {
    let body: { email?: string; role?: string } = {};
    try { body = await req.json(); } catch { /* empty body */ }
    const email = (body.email ?? "").trim().toLowerCase();
    const role = ["admin", "driver"].includes(body.role ?? "") ? body.role! : "admin";
    if (!email) return json({ ok: false, error: "email_required" }, 400);

    const { data: existing } = await sb
      .from("organization_members")
      .select("user_id")
      .eq("org_id", orgId)
      .eq("email", email)
      .maybeSingle();
    if (existing) return json({ ok: false, error: "already_member" }, 409);

    const { error } = await sb.from("org_invites").upsert(
      { org_id: orgId, email, role },
      { onConflict: "org_id,email" },
    );
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true });
  }

  if (req.method === "DELETE") {
    let body: { type?: string; user_id?: string; email?: string } = {};
    try { body = await req.json(); } catch { /* empty body */ }

    if (body.type === "invite" && body.email) {
      await sb.from("org_invites").delete().eq("org_id", orgId).eq("email", body.email);
      return json({ ok: true });
    }

    if (body.type === "member" && body.user_id) {
      if (body.user_id === userId) return json({ ok: false, error: "cannot_remove_self" }, 400);
      const { data: target } = await sb
        .from("organization_members")
        .select("role")
        .eq("org_id", orgId)
        .eq("user_id", body.user_id)
        .maybeSingle();
      if (target?.role === "owner") return json({ ok: false, error: "cannot_remove_owner" }, 400);
      await sb.from("organization_members").delete()
        .eq("org_id", orgId)
        .eq("user_id", body.user_id);
      return json({ ok: true });
    }

    return json({ ok: false, error: "invalid_request" }, 400);
  }

  if (req.method === "PATCH") {
    let body: { user_id?: string; role?: string } = {};
    try { body = await req.json(); } catch { /* empty body */ }
    if (!body.user_id || !body.role) return json({ ok: false, error: "user_id_and_role_required" }, 400);
    if (body.user_id === userId) return json({ ok: false, error: "cannot_change_own_role" }, 400);
    if (!["admin", "driver"].includes(body.role)) return json({ ok: false, error: "invalid_role" }, 400);
    await sb.from("organization_members").update({ role: body.role })
      .eq("org_id", orgId)
      .eq("user_id", body.user_id);
    return json({ ok: true });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/team",
  method: ["GET", "POST", "DELETE", "PATCH"],
};
