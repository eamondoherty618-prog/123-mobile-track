import type { Config, Context } from "@netlify/functions";

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

export default async (req: Request, context: Context) => {
  const userId = getUserId(req);
  if (!userId) return json({ ok: false, error: "unauthorized" }, 401);

  let body: { email?: string };
  try { body = await req.json(); } catch { body = {}; }
  const email = (body.email ?? "").trim().toLowerCase();
  if (!email) return json({ ok: false, error: "email required" }, 400);

  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name: "fleet-workspaces", consistency: "strong" });

  if (req.method === "POST") {
    await store.setJSON(`member/${email}`, { orgOwner: userId });
    return json({ ok: true });
  }

  if (req.method === "DELETE") {
    const existing = await store.get(`member/${email}`, { type: "json" }) as { orgOwner: string } | null;
    if (existing?.orgOwner !== userId) return json({ ok: false, error: "not found" }, 404);
    await store.delete(`member/${email}`);
    return json({ ok: true });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/workspace/members",
  method: ["POST", "DELETE"],
};
