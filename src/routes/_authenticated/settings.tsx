import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CalendarDays, Clock, Copy, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { useProfile, useRows } from "@/lib/data";
import {
  getServerStatus, googleConnectUrl, googleDisconnect, googleResolve, googleSyncNow, saveGoogleClient, sendTestPush,
} from "@/lib/server-fns";
import { PageHeader } from "@/components/PageHeader";
import { Field } from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Nest" }, { name: "description", content: "Notifications, Google Calendar and time zone." }] }),
  validateSearch: (s: Record<string, unknown>) => ({ google: typeof s["google"] === "string" ? (s["google"] as string) : undefined }),
  component: Settings,
});

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="card-soft space-y-4 p-6">
      <h2 className="flex items-center gap-2 text-2xl">{icon} {title}</h2>
      {children}
    </section>
  );
}

function Settings() {
  const { t } = useLang();
  const { google } = Route.useSearch();
  const status = useQuery({ queryKey: ["server-status"], queryFn: () => getServerStatus(), retry: 1 });

  useEffect(() => {
    if (!google) return;
    if (google === "connected") toast.success(t("googleResult_connected"));
    else if (google === "denied" || google === "invalid" || google === "error") toast.error(t(`googleResult_${google}`));
    window.history.replaceState(null, "", "/settings");
  }, [google, t]);

  return (
    <>
      <PageHeader title={t("settings")} />
      {status.isError && (
        <p role="alert" className="mb-6 rounded-xl border border-destructive/40 p-4 text-sm text-destructive">
          {t("serverNotReady", { msg: errMsg(status.error) })}
        </p>
      )}
      <div className="space-y-6">
        <PushSection vapidKey={status.data?.vapidPublicKey} />
        <GoogleSection status={status.data} />
        {status.data?.cronUrl && <CronSection url={status.data.cronUrl} />}
        <TimezoneSection />
      </div>
    </>
  );
}

// ───────────── Push ─────────────

function keyBytes(base64url: string) {
  const s = atob(base64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((base64url.length + 3) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

function PushSection({ vapidKey }: { vapidKey: string | undefined }) {
  const { t } = useLang();
  const qc = useQueryClient();
  const devices = useRows("push_subscriptions").data ?? [];
  const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(supported ? Notification.permission : "unsupported");
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker.getRegistration("/").then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription();
      setEndpoint(sub?.endpoint ?? null);
    });
  }, [supported]);

  async function enable() {
    if (!vapidKey) return;
    setBusy(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") return;
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidKey) }));
      const json = sub.toJSON();
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("push_subscriptions").upsert({
        user_id: auth.user?.id ?? "", endpoint: sub.endpoint, p256dh: json.keys?.["p256dh"] ?? "", auth: json.keys?.["auth"] ?? "",
        device_label: navigator.userAgent.includes("Android") ? "Android · Chrome" : navigator.platform || "Browser",
      }, { onConflict: "endpoint" });
      if (error) throw error;
      setEndpoint(sub.endpoint);
      qc.invalidateQueries({ queryKey: ["push_subscriptions"] });
    } catch (e) {
      toast.error(t("saveFailed"), { description: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  async function removeDevice(id: string, ep: string) {
    if (ep === endpoint) {
      const reg = await navigator.serviceWorker.getRegistration("/");
      await (await reg?.pushManager.getSubscription())?.unsubscribe();
      setEndpoint(null);
    }
    await supabase.from("push_subscriptions").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["push_subscriptions"] });
  }

  async function test() {
    try {
      const r = await sendTestPush({ data: { title: t("pushTestTitle"), body: t("pushTestBody") } });
      toast(t("pushSent", { n: r.sent }));
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  const on = permission === "granted" && !!endpoint && devices.some((d) => d.endpoint === endpoint);
  return (
    <Section icon={<Bell className="size-5" />} title={t("pushTitle")}>
      <p className="text-sm text-muted-foreground">{t("pushIntro")}</p>
      {permission === "unsupported" ? <p className="text-sm">{t("pushUnsupported")}</p>
        : permission === "denied" ? <p className="text-sm text-destructive">{t("pushDenied")}</p>
        : on ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm">{t("pushIsOn")}</p>
            <Button variant="outline" className="rounded-full" onClick={test}>{t("pushTest")}</Button>
          </div>
        ) : (
          <Button className="rounded-full" disabled={busy || !vapidKey} onClick={enable}><Bell className="size-4" /> {t("pushOn")}</Button>
        )}
      {devices.length > 0 && (
        <div>
          <div className="mb-2 text-sm font-medium">{t("devices")}</div>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {devices.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <Smartphone className="size-4 text-muted-foreground" />
                <span className="flex-1">{d.device_label ?? "—"}{d.endpoint === endpoint ? ` (${t("thisDevice")})` : ""}</span>
                <button type="button" aria-label={t("deleteLabel", { name: d.device_label ?? "" })} onClick={() => removeDevice(d.id, d.endpoint)}
                  className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t("installHint")}</p>
    </Section>
  );
}

// ───────────── Google Calendar ─────────────

function GoogleSection({ status }: { status: Awaited<ReturnType<typeof getServerStatus>> | undefined }) {
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const conn = useQuery({
    queryKey: ["google-status"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("google_status");
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
  const events = useRows("events").data ?? [];
  const issues = events.filter((e) => ["conflict", "delete_requested_by_google", "error"].includes(e.sync_state));
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => ["google-status", "events", "server-status"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  const run = async (fn: () => Promise<unknown>, done?: (r: unknown) => void) => {
    setBusy(true);
    try { const r = await fn(); done?.(r); } catch (e) { toast.error(t("syncFailed", { msg: errMsg(e) })); } finally { setBusy(false); refresh(); }
  };

  if (!status) return null;
  const connected = conn.data?.status === "connected";
  const needsReconnect = conn.data?.status === "needs_reconnect";

  return (
    <Section icon={<CalendarDays className="size-5" />} title={t("googleTitle")}>
      <p className="text-sm text-muted-foreground">{t("googleIntro")}</p>

      {!status.googleClientSet ? (
        status.owner ? (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => saveGoogleClient({ data: { clientId, clientSecret } }), () => { setClientId(""); setClientSecret(""); }); }}>
            <p className="text-sm">{t("googleSetup")}</p>
            <CopyLine value={status.redirectUri} />
            <Field id="g-client-id" label={t("clientId")}>
              <Input id="g-client-id" autoComplete="off" value={clientId} onChange={(e) => setClientId(e.target.value)} />
            </Field>
            <Field id="g-client-secret" label={t("clientSecret")}>
              <Input id="g-client-secret" type="password" autoComplete="off" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} />
            </Field>
            <Button type="submit" className="rounded-full" disabled={busy || !clientId || !clientSecret}>{t("save")}</Button>
          </form>
        ) : <p className="text-sm">{t("ownerOnly")}</p>
      ) : connected || needsReconnect ? (
        <div className="space-y-3">
          {needsReconnect && <p className="text-sm text-destructive">{t("googleReconnect")}</p>}
          {connected && (
            <p className="text-sm">
              <span className="font-medium text-success">{t("googleConnected")}</span>{" · "}
              {conn.data?.last_sync_at
                ? t("googleLastSync", { t: new Date(conn.data.last_sync_at).toLocaleString(lang === "ar" ? "ar-EG" : "en-GB", { dateStyle: "medium", timeStyle: "short" }) })
                : t("googleNever")}
            </p>
          )}
          {conn.data?.last_error && connected && <p className="text-sm text-destructive">{conn.data.last_error}</p>}
          <div className="flex flex-wrap gap-2">
            {connected && (
              <Button className="rounded-full" disabled={busy}
                onClick={() => run(() => googleSyncNow(), (r) => {
                  const res = r as { pushed?: number; pulled?: number };
                  toast.success(t("synced", { a: res.pushed ?? 0, b: res.pulled ?? 0 }));
                })}>
                {t("syncNow")}
              </Button>
            )}
            {needsReconnect && (
              <Button className="rounded-full" disabled={busy} onClick={() => run(async () => { window.location.href = (await googleConnectUrl()).url; })}>
                {t("googleConnect")}
              </Button>
            )}
            <Button variant="outline" className="rounded-full" disabled={busy} onClick={() => run(() => googleDisconnect())}>{t("disconnect")}</Button>
          </div>
        </div>
      ) : (
        <Button className="rounded-full" disabled={busy} onClick={() => run(async () => { window.location.href = (await googleConnectUrl()).url; })}>
          {t("googleConnect")}
        </Button>
      )}

      {issues.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium">{t("needsYou")}</div>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {issues.map((e) => (
              <li key={e.id} className="space-y-2 p-3 text-sm">
                <div><span className="font-medium">{e.title}</span> · {e.starts_on}</div>
                <div className="text-xs text-muted-foreground">
                  {e.sync_state === "conflict" ? t("changedBoth") : e.sync_state === "delete_requested_by_google" ? t("deletedInGoogle") : t("syncFailed", { msg: e.sync_error ?? "" })}
                </div>
                <div className="flex flex-wrap gap-2">
                  {e.sync_state === "conflict" && (
                    <>
                      <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={() => run(() => googleResolve({ data: { eventId: e.id, action: "nest" } }))}>{t("keepNest")}</Button>
                      <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={() => run(() => googleResolve({ data: { eventId: e.id, action: "google" } }))}>{t("keepGoogle")}</Button>
                    </>
                  )}
                  {e.sync_state === "delete_requested_by_google" && (
                    <>
                      <Button size="sm" variant="outline" className="rounded-full text-destructive" disabled={busy} onClick={() => run(() => googleResolve({ data: { eventId: e.id, action: "delete" } }))}>{t("deleteHereToo")}</Button>
                      <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={() => run(() => googleResolve({ data: { eventId: e.id, action: "keep" } }))}>{t("keepIt")}</Button>
                    </>
                  )}
                  {e.sync_state === "error" && connected && (
                    <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={() => run(() => googleSyncNow())}>{t("retry_sync")}</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}

// ───────────── Background job ─────────────

function CopyLine({ value }: { value: string }) {
  const { t } = useLang();
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg bg-muted px-3 py-2 text-xs">{value}</code>
      <Button type="button" variant="outline" size="sm" className="shrink-0 rounded-full"
        onClick={() => navigator.clipboard.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }).catch(() => null)}>
        <Copy className="size-3.5" /> {done ? t("copied") : t("copy")}
      </Button>
    </div>
  );
}

function CronSection({ url }: { url: string }) {
  const { t } = useLang();
  return (
    <Section icon={<Clock className="size-5" />} title={t("cronTitle")}>
      <p className="text-sm text-muted-foreground">{t("cronIntro")}</p>
      <CopyLine value={url} />
      <p className="text-xs text-muted-foreground">{t("cronKeep")}</p>
    </Section>
  );
}

// ───────────── Time zone ─────────────

const ZONES = ["Africa/Cairo", "Asia/Riyadh", "Asia/Dubai", "Europe/London", "Europe/Berlin", "America/New_York"];

function TimezoneSection() {
  const { t } = useLang();
  const { profile, save } = useProfile();
  const current = profile?.timezone ?? "Africa/Cairo";
  return (
    <Section icon={<Clock className="size-5" />} title={t("timezone")}>
      <select aria-label={t("timezone")} className="h-9 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm"
        value={current} onChange={(e) => save.mutate({ timezone: e.target.value })}>
        {(ZONES.includes(current) ? ZONES : [current, ...ZONES]).map((z) => <option key={z} value={z}>{z}</option>)}
      </select>
    </Section>
  );
}
