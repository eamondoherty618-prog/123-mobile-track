import type { Config, Context } from "@netlify/functions";
import webpush from "web-push";

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_EMAIL = "mailto:ops@123mobiletrack.com";

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

export default async (req: Request, context: Context) => {
  const userId = getUserId(context);

  // Public VAPID key endpoint — no auth required
  if (req.method === "GET") {
    const url = new URL(req.url);
    if (url.searchParams.get("vapidPublicKey") === "1") {
      return json({ ok: true, publicKey: VAPID_PUBLIC });
    }
    return json({ ok: false, error: "missing param" }, 400);
  }

  if (req.method === "POST") {
    if (!userId) return json({ ok: false, error: "unauthorized" }, 401);

    const body = (await req.json()) as { action?: string; subscription?: PushSubscriptionJSON };
    const { getStore } = await import("@netlify/blobs");
    const store = getStore({ name: "fleet-workspaces", consistency: "strong" });

    if (body.action === "subscribe" && body.subscription) {
      await store.setJSON(`push/${userId}`, body.subscription);
      return json({ ok: true });
    }

    if (body.action === "unsubscribe") {
      await store.delete(`push/${userId}`);
      return json({ ok: true });
    }

    return json({ ok: false, error: "unknown action" }, 400);
  }

  return new Response("Method not allowed", { status: 405 });
};

/** Called from telemetry.ts when an alert fires — broadcasts to all subscribers */
export async function broadcastPush(title: string, body: string, url = "/alerts") {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;
  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name: "fleet-workspaces", consistency: "strong" });

  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);

  const { blobs } = await store.list({ prefix: "push/" });
  await Promise.allSettled(
    blobs.map(async (blob) => {
      const sub = await store.get(blob.key, { type: "json" }) as PushSubscriptionJSON | null;
      if (!sub) return;
      try {
        await webpush.sendNotification(
          sub as Parameters<typeof webpush.sendNotification>[0],
          JSON.stringify({ title, body, url }),
        );
      } catch {
        // Expired or revoked — clean up
        await store.delete(blob.key);
      }
    }),
  );
}

export const config: Config = { path: "/api/push", method: ["GET", "POST"] };
