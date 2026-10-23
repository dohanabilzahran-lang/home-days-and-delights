import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import "@lovable.dev/cloud-auth-js/styles.css";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LangToggle, useLang } from "@/lib/i18n";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Nest" },
      { name: "description", content: "Sign in or create your Nest account." },
      { property: "og:title", content: "Sign in — Nest" },
      { property: "og:description", content: "Access your calm home organizer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => data.session && navigate({ to: "/dashboard", replace: true }));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => s && navigate({ to: "/dashboard", replace: true }));
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error, data } =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (mode === "up" && !data.session) toast.success(t("checkEmail"));
  }

  async function oauth(provider: "google" | "lovable") {
    const r = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
    if (r.error) toast.error(String(r.error.message ?? r.error));
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card-soft w-full max-w-sm p-8">
        <div className="mb-6 flex items-center justify-between">
          <span className="font-display text-2xl">{t("appName")}</span>
          <LangToggle />
        </div>
        <h1 className="mb-6 text-3xl">{mode === "in" ? t("signIn") : t("signUp")}</h1>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">{t("email")}</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw">{t("password")}</Label>
            <Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" disabled={busy} className="w-full rounded-full">
            {mode === "in" ? t("signIn") : t("signUp")}
          </Button>
        </form>
        <div className="my-5 text-center text-xs text-muted-foreground">{t("orContinue")}</div>
        <div className="space-y-2">
          <Button variant="outline" className="w-full rounded-full" onClick={() => oauth("google")}>
            {t("google")}
          </Button>
          <button type="button" className="lovable-auth-button w-full" onClick={() => oauth("lovable")}>
            Continue with Lovable
          </button>
        </div>
        <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="mt-6 w-full text-sm text-muted-foreground hover:text-foreground">
          {mode === "in" ? t("noAccount") : t("haveAccount")}
        </button>
      </div>
    </div>
  );
}
