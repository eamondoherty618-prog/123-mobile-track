import type { Config, Context } from "@netlify/functions";

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

export default async (req: Request, context: Context) => {
  const userInfo = getUserInfo(req);
  if (!userInfo) return json({ ok: false, error: "unauthorized" }, 401);

  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name: "fleet-workspaces", consistency: "strong" });

  // If this user is a member of another org, use that org's workspace instead.
  let key = `workspace/${userInfo.userId}`;
  if (userInfo.email) {
    const membership = await store.get(`member/${userInfo.email}`, { type: "json" }) as { orgOwner: string } | null;
    if (membership?.orgOwner) key = `workspace/${membership.orgOwner}`;
  }

  if (req.method === "GET") {
    const data = await store.get(key, { type: "json" });
    return json({ ok: true, workspace: data ?? null });
  }

  if (req.method === "POST") {
    try {
      const body = await req.json();
      await store.setJSON(key, body);
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
