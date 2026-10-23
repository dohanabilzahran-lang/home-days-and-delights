import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { b64url, generateVapidKeys, type VapidKeys } from "@/server/webpush.server";

/**
 * Server settings. An environment variable wins if set; otherwise the value lives in the
 * service-role-only `app_config` table. Keys the app can make itself (VAPID, cron secret, OAuth
 * state secret) are generated on first use, so no person ever has to handle them.
 */
export async function getConfig(key: string): Promise<string | null> {
  const env = typeof process !== "undefined" ? process.env[key] : undefined;
  if (env) return env;
  const { data, error } = await supabaseAdmin.from("app_config").select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  return data?.value ?? null;
}

export async function setConfig(key: string, value: string) {
  const { error } = await supabaseAdmin.from("app_config").upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/** Returns the stored value, or stores `make()` once. A concurrent first call keeps whichever landed first. */
async function getOrCreate(key: string, make: () => Promise<string> | string) {
  const existing = await getConfig(key);
  if (existing) return existing;
  const value = await make();
  const { error } = await supabaseAdmin.from("app_config").insert({ key, value });
  if (error && error.code !== "23505") throw error;
  return (await getConfig(key)) ?? value;
}

const randomSecret = () => b64url(globalThis.crypto.getRandomValues(new Uint8Array(32)));

export async function getVapidKeys(): Promise<VapidKeys> {
  const json = await getOrCreate("VAPID_KEYS", async () => JSON.stringify(await generateVapidKeys()));
  return JSON.parse(json) as VapidKeys;
}
export const getCronSecret = () => getOrCreate("CRON_SECRET", randomSecret);
export const getStateSecret = () => getOrCreate("OAUTH_STATE_SECRET", randomSecret);

/**
 * The account that may change server settings: the first signed-in user to open Settings.
 * (Nest is a single-person app; turn off new sign-ups once her account exists.)
 */
export async function isOwner(userId: string) {
  return (await getOrCreate("OWNER_USER_ID", () => userId)) === userId;
}
