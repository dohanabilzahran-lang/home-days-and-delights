import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "ar";

const dict = {
  appName: { en: "Nest", ar: "عُش" },
  tagline: { en: "Your calm home, all in one place.", ar: "بيتك الهادئ، في مكان واحد." },
  intro: {
    en: "Budget, skincare, cleaning, kids' routines and recipes — gently organized for you.",
    ar: "الميزانية، العناية بالبشرة، التنظيف، روتين الأطفال والوصفات — منظمة بهدوء من أجلك.",
  },
  getStarted: { en: "Get started", ar: "ابدئي الآن" },
  openApp: { en: "Open my space", ar: "افتحي مساحتي" },
  signIn: { en: "Sign in", ar: "تسجيل الدخول" },
  signUp: { en: "Create account", ar: "إنشاء حساب" },
  signOut: { en: "Sign out", ar: "تسجيل الخروج" },
  email: { en: "Email", ar: "البريد الإلكتروني" },
  password: { en: "Password", ar: "كلمة المرور" },
  orContinue: { en: "or", ar: "أو" },
  google: { en: "Continue with Google", ar: "المتابعة باستخدام Google" },
  haveAccount: { en: "Already have an account? Sign in", ar: "لديك حساب؟ سجلي الدخول" },
  noAccount: { en: "New here? Create an account", ar: "جديدة هنا؟ أنشئي حساباً" },
  checkEmail: { en: "Check your email to confirm your account.", ar: "تحققي من بريدك لتأكيد حسابك." },
  today: { en: "Today", ar: "اليوم" },
  budget: { en: "Budget", ar: "الميزانية" },
  skincare: { en: "Skincare", ar: "العناية بالبشرة" },
  cleaning: { en: "Cleaning", ar: "التنظيف" },
  kids: { en: "Kids", ar: "الأطفال" },
  recipes: { en: "Recipes", ar: "الوصفات" },
  add: { en: "Add", ar: "إضافة" },
  delete: { en: "Delete", ar: "حذف" },
  title: { en: "Title", ar: "العنوان" },
  amount: { en: "Amount", ar: "المبلغ" },
  income: { en: "Income", ar: "دخل" },
  expense: { en: "Expense", ar: "مصروف" },
  category: { en: "Category", ar: "الفئة" },
  date: { en: "Date", ar: "التاريخ" },
  balance: { en: "Balance this month", ar: "رصيد هذا الشهر" },
  spent: { en: "Spent", ar: "المصروف" },
  earned: { en: "Earned", ar: "الدخل" },
  morning: { en: "Morning", ar: "الصباح" },
  evening: { en: "Evening", ar: "المساء" },
  step: { en: "Step", ar: "الخطوة" },
  product: { en: "Product", ar: "المنتج" },
  room: { en: "Room", ar: "الغرفة" },
  everyDays: { en: "Every (days)", ar: "كل (أيام)" },
  due: { en: "Due", ar: "مستحق" },
  dueIn: { en: "Due in {n} d", ar: "بعد {n} يوم" },
  overdue: { en: "Overdue", ar: "متأخر" },
  markDone: { en: "Done", ar: "تم" },
  child: { en: "Child's name", ar: "اسم الطفل" },
  time: { en: "Time", ar: "الوقت" },
  ingredients: { en: "Ingredients (one per line)", ar: "المكونات (واحد في كل سطر)" },
  steps: { en: "Steps", ar: "الخطوات" },
  minutes: { en: "Minutes", ar: "الدقائق" },
  min: { en: "min", ar: "دقيقة" },
  newRecipe: { en: "New recipe", ar: "وصفة جديدة" },
  empty: { en: "Nothing here yet.", ar: "لا يوجد شيء بعد." },
  goodMorning: { en: "Hello", ar: "مرحباً" },
  todayTasks: { en: "Your day at a glance", ar: "يومك في لمحة" },
  doneOf: { en: "{a} of {b} done", ar: "{a} من {b} مكتملة" },
  tasksDue: { en: "{n} tasks due", ar: "{n} مهام مستحقة" },
  saved: { en: "{n} recipes saved", ar: "{n} وصفات محفوظة" },
  saveFailed: { en: "Couldn't save. Check your connection and try again.", ar: "تعذّر الحفظ. تحققي من الاتصال وحاولي مرة أخرى." },
  loading: { en: "Loading…", ar: "جارٍ التحميل…" },
  loadFailed: { en: "Couldn't load this list. Check your connection.", ar: "تعذّر تحميل القائمة. تحققي من الاتصال." },
  retry: { en: "Try again", ar: "حاولي مرة أخرى" },
  cancel: { en: "Cancel", ar: "إلغاء" },
  deleteTitle: { en: "Delete “{name}”?", ar: "حذف «{name}»؟" },
  deleteBody: { en: "This can't be undone.", ar: "لا يمكن التراجع عن ذلك." },
  markDoneLabel: { en: "Mark “{name}” done", ar: "تحديد «{name}» كمكتملة" },
  markNotDoneLabel: { en: "Mark “{name}” not done", ar: "إلغاء إكمال «{name}»" },
  deleteLabel: { en: "Delete “{name}”", ar: "حذف «{name}»" },
  cats: {
    en: "Groceries,Bills,Kids,Beauty,Home,Transport,Salary,Other",
    ar: "بقالة,فواتير,أطفال,تجميل,منزل,مواصلات,راتب,أخرى",
  },
} as const;

export type Key = keyof typeof dict;

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: Key, vars?: Record<string, string | number>) => string };
const LangContext = createContext<Ctx | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    const saved = localStorage.getItem("lang");
    if (saved === "ar" || saved === "en") setLangState(saved);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);
  const setLang = (l: Lang) => {
    localStorage.setItem("lang", l);
    setLangState(l);
  };
  const t = (k: Key, vars?: Record<string, string | number>) => {
    let s: string = dict[k][lang];
    if (vars) for (const [n, v] of Object.entries(vars)) s = s.replace(`{${n}}`, String(v));
    return s;
  };
  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export function useLang() {
  const c = useContext(LangContext);
  if (!c) throw new Error("useLang outside LangProvider");
  return c;
}

export function LangToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === "en" ? "ar" : "en")}
      className={`rounded-full border border-border px-3 py-1 text-sm font-medium transition-colors hover:bg-muted ${className}`}
    >
      {lang === "en" ? "العربية" : "English"}
    </button>
  );
}
