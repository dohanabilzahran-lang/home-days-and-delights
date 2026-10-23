import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Wallet, Sparkles, Brush, Baby, ChefHat } from "lucide-react";
import hero from "@/assets/hero.jpg";
import { supabase } from "@/integrations/supabase/client";
import { LangToggle, useLang } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nest — Budget, skincare, cleaning, kids & recipes" },
      { name: "description", content: "One calm space to organize your budget, skincare routine, cleaning schedule, kids' routine and recipes." },
      { property: "og:title", content: "Nest — Your calm home organizer" },
      { property: "og:description", content: "Organize your home life gently, in English or Arabic." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { t } = useLang();
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);
  const items = [
    { icon: Wallet, k: "budget" as const },
    { icon: Sparkles, k: "skincare" as const },
    { icon: Brush, k: "cleaning" as const },
    { icon: Baby, k: "kids" as const },
    { icon: ChefHat, k: "recipes" as const },
  ];
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="flex flex-col justify-between p-8 md:p-14">
        <div className="flex items-center justify-between">
          <span className="font-display text-2xl">{t("appName")}</span>
          <LangToggle />
        </div>
        <div className="my-16 max-w-md">
          <h1 className="text-5xl leading-tight md:text-6xl">{t("tagline")}</h1>
          <p className="mt-5 text-lg text-muted-foreground">{t("intro")}</p>
          <Link
            to={signedIn ? "/dashboard" : "/auth"}
            className="mt-8 inline-flex rounded-full bg-primary px-7 py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            {signedIn ? t("openApp") : t("getStarted")}
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {items.map(({ icon: Icon, k }) => (
            <span key={k} className="flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm">
              <Icon className="size-4" /> {t(k)}
            </span>
          ))}
        </div>
      </div>
      <img src={hero} alt="" className="hidden h-screen w-full object-cover md:block" />
    </div>
  );
}
