import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

type EventUpdate = Database["public"]["Tables"]["events"]["Update"];
import { fromGoogle, toGoogle, type GoogleEvent } from "@/lib/gcal";
import { b64url, unb64url } from "@/server/webpush.server";
import { getConfig, getStateSecret, setConfig } from "@/server/config.server";

/**
 * Google Calendar, two-way, for the separate "Nest" calendar only (decisions 1–4):
 * - scope calendar.app.created: Nest can only see calendars it created, never her main calendar
 * - only one-off events sync; repeating tasks stay in Nest
 * - a deletion on either side is never applied silently: Nest deletions are confirmed in the app
 *   before they are sent; Google deletions wait in Nest for her to confirm or keep
 * - an item changed on both sides between syncs becomes a conflict for her to resolve
 */

const SCOPE = "https://www.googleapis.com/auth/calendar.app.created";
const API = "https://www.googleapis.com/calendar/v3";
const enc = new TextEncoder();

type Conn = {
  user_id: string; calendar_id: string | null; refresh_token: string | null; access_token: string | null;
  access_expires_at: string | null; sync_token: string | null; status: string;
};

export class GoogleError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function client() {
  const id = await getConfig("GOOGLE_CLIENT_ID");
  const secret = await getConfig("GOOGLE_CLIENT_SECRET");
  if (!id || !secret) throw new GoogleError("Google client is not set up yet", 412);
  return { id, secret };
}

async function sign(data: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(await getStateSecret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

/** URL that starts the Google consent screen. The signed state ties the reply to this user for 15 minutes. */
export async function connectUrl(userId: string, origin: string) {
  const { id } = await client();
  const payload = `${userId}.${Date.now()}`;
  const state = `${b64url(enc.encode(payload))}.${await sign(payload)}`;
  const p = new URLSearchParams({
    client_id: id, redirect_uri: `${origin}/api/google/callback`, response_type: "code", scope: SCOPE,
    access_type: "offline", prompt: "consent", include_granted_scopes: "true", state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

async function verifyState(state: string) {
  const [p, sig] = state.split(".");
  if (!p || !sig) return null;
  const payload = new TextDecoder().decode(unb64url(p));
  if ((await sign(payload)) !== sig) return null;
  const [userId, ts] = payload.split(".");
  if (!userId || Date.now() - Number(ts) > 15 * 60 * 1000) return null;
  return userId;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body),
  });
  const json = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
  if (!res.ok) throw new GoogleError(json.error ?? `token ${res.status}`, res.status);
  return json;
}

async function gfetch(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (res.status === 204) return null;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new GoogleError((json as { error?: { message?: string } }).error?.message ?? `Google ${res.status}`, res.status);
  return json;
}

const timeZoneOf = async (userId: string) =>
  ((await supabaseAdmin.from("profiles").select("timezone").eq("user_id", userId).maybeSingle()).data?.timezone) ?? "Africa/Cairo";

/** Handles Google's redirect back: stores tokens and makes (or reuses) the "Nest" calendar. */
export async function handleCallback(url: URL) {
  const code = url.searchParams.get("code");
  const userId = await verifyState(url.searchParams.get("state") ?? "");
  if (url.searchParams.get("error")) return "denied";
  if (!code || !userId) return "invalid";
  const { id, secret } = await client();
  const tok = await tokenRequest({ code, client_id: id, client_secret: secret, redirect_uri: `${url.origin}/api/google/callback`, grant_type: "authorization_code" });
  if (!tok.access_token) return "invalid";
  // Reuse the calendar from an earlier connection so events are matched, not duplicated.
  let calendarId = await getConfig(`GOOGLE_CALENDAR_ID:${userId}`);
  if (calendarId) {
    try { await gfetch(tok.access_token, `/calendars/${encodeURIComponent(calendarId)}`); } catch { calendarId = null; }
  }
  if (!calendarId) {
    const cal = (await gfetch(tok.access_token, "/calendars", { method: "POST", body: JSON.stringify({ summary: "Nest", timeZone: await timeZoneOf(userId) }) })) as { id: string };
    calendarId = cal.id;
    await setConfig(`GOOGLE_CALENDAR_ID:${userId}`, calendarId);
  }
  const { error } = await supabaseAdmin.from("google_connections").upsert({
    user_id: userId, calendar_id: calendarId, refresh_token: tok.refresh_token ?? null, access_token: tok.access_token,
    access_expires_at: new Date(Date.now() + (tok.expires_in ?? 3600) * 1000).toISOString(),
    sync_token: null, status: "connected", last_error: null,
  });
  if (error) throw error;
  return "connected";
}

async function accessToken(conn: Conn) {
  if (conn.access_token && conn.access_expires_at && Date.parse(conn.access_expires_at) > Date.now() + 60_000) return conn.access_token;
  if (!conn.refresh_token) throw new GoogleError("invalid_grant", 400);
  const { id, secret } = await client();
  try {
    const tok = await tokenRequest({ refresh_token: conn.refresh_token, client_id: id, client_secret: secret, grant_type: "refresh_token" });
    const expires = new Date(Date.now() + (tok.expires_in ?? 3600) * 1000).toISOString();
    await supabaseAdmin.from("google_connections").update({ access_token: tok.access_token ?? null, access_expires_at: expires }).eq("user_id", conn.user_id);
    return tok.access_token!;
  } catch (e) {
    // Expired or revoked access: ask her to reconnect; nothing is deleted on either side.
    if (e instanceof GoogleError && e.status === 400) {
      await supabaseAdmin.from("google_connections").update({ status: "needs_reconnect", last_error: "Google access expired or was removed" }).eq("user_id", conn.user_id);
    }
    throw e;
  }
}

export async function disconnect(userId: string) {
  const { data } = await supabaseAdmin.from("google_connections").select("refresh_token").eq("user_id", userId).maybeSingle();
  if (data?.refresh_token) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(data.refresh_token)}`, { method: "POST" }).catch(() => null);
  await supabaseAdmin.from("google_connections").delete().eq("user_id", userId);
}

type Ev = {
  id: string; title: string; notes: string; starts_on: string; start_time: string | null; end_time: string | null;
  remind_minutes: number | null; sync_to_google: boolean; google_event_id: string | null; google_etag: string | null;
  google_updated_at: string | null; sync_state: string; deleted_at: string | null; updated_at: string;
};

/** One full sync for one user: send Nest changes, then read Google changes. */
export async function syncUser(userId: string) {
  const { data: conn } = await supabaseAdmin.from("google_connections").select("*").eq("user_id", userId).maybeSingle();
  if (!conn || conn.status !== "connected" || !conn.calendar_id) return { skipped: true };
  const token = await accessToken(conn);
  const tz = await timeZoneOf(userId);
  const cal = `/calendars/${encodeURIComponent(conn.calendar_id)}/events`;
  const setEv = (id: string, values: EventUpdate) => supabaseAdmin.from("events").update(values).eq("id", id);
  let pushed = 0;
  let pulled = 0;

  // 1. Nest → Google
  const { data: outgoing } = await supabaseAdmin.from("events").select("*").eq("user_id", userId)
    .in("sync_state", ["pending", "delete_requested_by_nest", "error"]);
  for (const e of (outgoing ?? []) as Ev[]) {
    try {
      if (e.sync_state === "delete_requested_by_nest" || (!e.sync_to_google && e.google_event_id)) {
        if (e.google_event_id) {
          try { await gfetch(token, `${cal}/${encodeURIComponent(e.google_event_id)}`, { method: "DELETE" }); }
          catch (err) { if (!(err instanceof GoogleError && (err.status === 404 || err.status === 410))) throw err; }
        }
        if (e.deleted_at) await supabaseAdmin.from("events").delete().eq("id", e.id);
        else await setEv(e.id, { google_event_id: null, google_etag: null, google_updated_at: null, sync_state: "local", sync_error: null });
      } else if (e.sync_to_google && !e.deleted_at) {
        const body = JSON.stringify(toGoogle(e, tz));
        const g = (e.google_event_id
          ? await gfetch(token, `${cal}/${encodeURIComponent(e.google_event_id)}`, { method: "PATCH", body })
          : await gfetch(token, cal, { method: "POST", body })) as GoogleEvent;
        await setEv(e.id, { google_event_id: g.id ?? null, google_etag: g.etag ?? null, google_updated_at: g.updated ?? null, sync_state: "synced", sync_error: null });
      } else if (!e.sync_to_google) {
        await setEv(e.id, { sync_state: "local", sync_error: null });
      }
      pushed++;
    } catch (err) {
      await setEv(e.id, { sync_state: "error", sync_error: err instanceof Error ? err.message : "Sync failed" });
    }
  }

  // 2. Google → Nest (incremental with a sync token; a full read when Google says the token is stale)
  const { data: localAll } = await supabaseAdmin.from("events").select("*").eq("user_id", userId);
  const local = (localAll ?? []) as Ev[];
  let syncToken: string | null = conn.sync_token;
  let pageToken: string | null = null;
  let nextSyncToken: string | null = null;
  for (let guard = 0; guard < 50; guard++) {
    const q = new URLSearchParams({ singleEvents: "true", showDeleted: "true", maxResults: "250" });
    if (pageToken) q.set("pageToken", pageToken);
    if (syncToken) q.set("syncToken", syncToken);
    else q.set("timeMin", new Date(Date.now() - 30 * 86400000).toISOString());
    let page: { items?: GoogleEvent[]; nextPageToken?: string; nextSyncToken?: string };
    try {
      page = (await gfetch(token, `${cal}?${q}`)) as typeof page;
    } catch (err) {
      if (err instanceof GoogleError && err.status === 410 && syncToken) { syncToken = null; pageToken = null; continue; }
      throw err;
    }
    for (const g of page.items ?? []) {
      const mine = local.find((l) => l.google_event_id === g.id) ?? local.find((l) => l.id === g.extendedProperties?.private?.["nestId"]);
      if (g.status === "cancelled") {
        // Deleted in Google: keep it in Nest and ask her (never delete silently).
        if (mine && !mine.deleted_at && mine.sync_state !== "delete_requested_by_nest") {
          await setEv(mine.id, { sync_state: "delete_requested_by_google" });
          pulled++;
        }
        continue;
      }
      if (mine) {
        if (g.updated && g.updated === mine.google_updated_at) continue; // our own write coming back
        if (mine.sync_state === "pending") {
          // Changed in both places since the last sync: keep both versions until she chooses.
          await setEv(mine.id, { sync_state: "conflict", sync_error: JSON.stringify({ google: fromGoogle(g, tz), etag: g.etag, updated: g.updated }) });
        } else {
          await setEv(mine.id, {
            ...fromGoogle(g, tz), google_event_id: g.id ?? null, google_etag: g.etag ?? null, google_updated_at: g.updated ?? null,
            sync_state: "synced", sync_error: null, deleted_at: null, sync_to_google: true, updated_at: new Date().toISOString(),
          });
        }
      } else {
        await supabaseAdmin.from("events").insert({
          user_id: userId, ...fromGoogle(g, tz), sync_to_google: true, google_event_id: g.id ?? null, google_etag: g.etag ?? null,
          google_updated_at: g.updated ?? null, sync_state: "synced",
        });
      }
      pulled++;
    }
    pageToken = page.nextPageToken ?? null;
    if (!pageToken) { nextSyncToken = page.nextSyncToken ?? null; break; }
  }
  await supabaseAdmin.from("google_connections")
    .update({ sync_token: nextSyncToken, last_sync_at: new Date().toISOString(), last_error: null }).eq("user_id", userId);
  return { pushed, pulled };
}

/** Runs sync for everyone connected; one failure doesn't stop the rest. */
export async function syncAll() {
  const { data } = await supabaseAdmin.from("google_connections").select("user_id").eq("status", "connected");
  const out: Record<string, unknown> = {};
  for (const c of data ?? []) {
    try { out[c.user_id] = await syncUser(c.user_id); }
    catch (e) {
      const msg = e instanceof Error ? e.message : "Sync failed";
      await supabaseAdmin.from("google_connections").update({ last_error: msg }).eq("user_id", c.user_id);
      out[c.user_id] = { error: msg };
    }
  }
  return out;
}

/**
 * Her answer to a sync question:
 * - conflict: keep "nest" (send Nest's version) or "google" (take Google's)
 * - deleted in Google: "delete" here too, or "keep" (re-create it in Google)
 */
export async function resolve(userId: string, eventId: string, action: "nest" | "google" | "delete" | "keep") {
  const { data: e } = await supabaseAdmin.from("events").select("*").eq("id", eventId).eq("user_id", userId).maybeSingle();
  if (!e) throw new GoogleError("Event not found", 404);
  if (action === "delete") await supabaseAdmin.from("events").delete().eq("id", eventId);
  else if (action === "keep") await supabaseAdmin.from("events").update({ google_event_id: null, google_etag: null, google_updated_at: null, sync_state: "pending" }).eq("id", eventId);
  else if (action === "nest") await supabaseAdmin.from("events").update({ sync_state: "pending", sync_error: null }).eq("id", eventId);
  else {
    const saved = e.sync_error ? (JSON.parse(e.sync_error) as { google: object; etag: string; updated: string }) : null;
    if (!saved) throw new GoogleError("Google version not available", 409);
    await supabaseAdmin.from("events").update({ ...saved.google, google_etag: saved.etag, google_updated_at: saved.updated, sync_state: "synced", sync_error: null }).eq("id", eventId);
  }
}
