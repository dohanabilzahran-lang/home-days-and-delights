import { createFileRoute } from "@tanstack/react-router";

/**
 * Called every 5 minutes by an external scheduler (e.g. cron-job.org) with the secret key from
 * Settings. Sends due reminders as push notifications and runs Google Calendar sync.
 * Safe to call repeatedly: every step is de-duplicated.
 */
async function run(request: Request) {
  const { getCronSecret } = await import("@/server/config.server");
  const url = new URL(request.url);
  const given = url.searchParams.get("key") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const secret = await getCronSecret();
  // Constant-time comparison so the key can't be guessed from response timing.
  let diff = given.length ^ secret.length;
  for (let i = 0; i < secret.length; i++) diff |= secret.charCodeAt(i) ^ given.charCodeAt(i % (given.length || 1));
  if (diff !== 0) return new Response("Unauthorized", { status: 401 });

  const { runReminders } = await import("@/server/reminders.server");
  const { syncAll } = await import("@/server/google.server");
  const result: Record<string, unknown> = {};
  try { result["reminders"] = await runReminders(); } catch (e) { result["reminders"] = { error: e instanceof Error ? e.message : "failed" }; }
  try { result["google"] = await syncAll(); } catch (e) { result["google"] = { error: e instanceof Error ? e.message : "failed" }; }
  return Response.json({ ok: true, at: new Date().toISOString(), ...result });
}

export const Route = createFileRoute("/api/cron")({
  server: { handlers: { GET: ({ request }) => run(request), POST: ({ request }) => run(request) } },
});
