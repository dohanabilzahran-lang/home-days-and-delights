import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/*
 * Calls from the app to the server. Each one checks the signed-in user first (requireSupabaseAuth).
 * Server-only modules are imported inside the handlers so they never reach the browser bundle.
 */

async function origin() {
  const { getRequest } = await import("@tanstack/react-start/server");
  return new URL(getRequest().url).origin;
}

async function assertOwner(userId: string) {
  const { isOwner } = await import("@/server/config.server");
  if (!(await isOwner(userId))) throw new Error("Only the app owner can change this setting");
}

export const getServerStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getConfig, getCronSecret, getVapidKeys, isOwner } = await import("@/server/config.server");
    const owner = await isOwner(context.userId);
    const [vapid, clientId] = await Promise.all([getVapidKeys(), getConfig("GOOGLE_CLIENT_ID")]);
    const o = await origin();
    return {
      owner,
      vapidPublicKey: vapid.publicKey,
      googleClientSet: !!clientId,
      redirectUri: `${o}/api/google/callback`,
      cronUrl: owner ? `${o}/api/cron?key=${encodeURIComponent(await getCronSecret())}` : null,
    };
  });

export const saveGoogleClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { clientId: string; clientSecret: string }) => {
    if (!d?.clientId?.trim() || !d?.clientSecret?.trim()) throw new Error("Client ID and secret are required");
    return { clientId: d.clientId.trim(), clientSecret: d.clientSecret.trim() };
  })
  .handler(async ({ context, data }) => {
    await assertOwner(context.userId);
    const { setConfig } = await import("@/server/config.server");
    await setConfig("GOOGLE_CLIENT_ID", data.clientId);
    await setConfig("GOOGLE_CLIENT_SECRET", data.clientSecret);
    return { ok: true };
  });

export const googleConnectUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { connectUrl } = await import("@/server/google.server");
    return { url: await connectUrl(context.userId, await origin()) };
  });

export const googleSyncNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { syncUser } = await import("@/server/google.server");
    return await syncUser(context.userId);
  });

export const googleDisconnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { disconnect } = await import("@/server/google.server");
    await disconnect(context.userId);
    return { ok: true };
  });

export const googleResolve = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { eventId: string; action: "nest" | "google" | "delete" | "keep" }) => {
    if (!d?.eventId || !["nest", "google", "delete", "keep"].includes(d.action)) throw new Error("Invalid request");
    return d;
  })
  .handler(async ({ context, data }) => {
    const { resolve } = await import("@/server/google.server");
    await resolve(context.userId, data.eventId, data.action);
    return { ok: true };
  });

export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { title: string; body: string }) => d)
  .handler(async ({ context, data }) => {
    const { pushToUser } = await import("@/server/reminders.server");
    return { sent: await pushToUser(context.userId, { title: data.title, body: data.body, url: "/settings", tag: "test" }) };
  });
