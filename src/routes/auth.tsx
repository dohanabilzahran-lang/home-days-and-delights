import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { LangToggle, useLang } from "@/lib/i18n";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Nest" },
      { name: "description", content: "Sign in to your Nest home organizer." },
      { property: "og:title", content: "Sign in — Nest" },
      { property: "og:description", content: "Access your calm home organizer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

/** Google is the only sign-in method (decision 6 in the audit). */
function AuthPage() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => data.session && navigate({ to: "/dashboard", replace: true }));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => s && navigate({ to: "/dashboard", replace: true }));
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function signIn() {
    setBusy(true);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    setBusy(false);
    if (r.error) toast.error(String(r.error.message ?? r.error));
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card-soft w-full max-w-sm p-8">
        <div className="mb-6 flex items-center justify-between">
          <span className="font-display text-2xl">{t("appName")}</span>
          <LangToggle />
        </div>
        <h1 className="mb-2 text-3xl">{t("signIn")}</h1>
        <p className="mb-6 text-sm text-muted-foreground">{t("signInGoogle")}</p>
        <Button className="w-full rounded-full" disabled={busy} onClick={signIn}>
          {t("google")}
        </Button>
      </div>
    </div>
  );
}
