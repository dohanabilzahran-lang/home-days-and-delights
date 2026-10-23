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
  google: { en: "Continue with Google", ar: "المتابعة باستخدام Google" },
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
  cat_groceries: { en: "Groceries", ar: "بقالة" },
  cat_bills: { en: "Bills", ar: "فواتير" },
  cat_kids: { en: "Kids", ar: "أطفال" },
  cat_beauty: { en: "Beauty", ar: "تجميل" },
  cat_home: { en: "Home", ar: "منزل" },
  cat_transport: { en: "Transport", ar: "مواصلات" },
  cat_salary: { en: "Salary", ar: "راتب" },
  cat_other: { en: "Other", ar: "أخرى" },
  // Navigation
  more: { en: "More", ar: "المزيد" },
  navHome: { en: "Home", ar: "البيت" },
  navFamily: { en: "Family & me", ar: "العائلة وأنا" },
  navMoney: { en: "Money", ar: "المال" },
  language: { en: "Language", ar: "اللغة" },
  // Editing
  edit: { en: "Edit", ar: "تعديل" },
  editLabel: { en: "Edit “{name}”", ar: "تعديل «{name}»" },
  save: { en: "Save", ar: "حفظ" },
  name: { en: "Name", ar: "الاسم" },
  // Rooms
  rooms: { en: "Rooms", ar: "الغرف" },
  manageRooms: { en: "Manage rooms", ar: "إدارة الغرف" },
  newRoom: { en: "New room", ar: "غرفة جديدة" },
  noRoom: { en: "No room", ar: "بدون غرفة" },
  roomInUse: { en: "Move or delete this room's tasks before deleting it.", ar: "انقلي مهام هذه الغرفة أو احذفيها قبل حذف الغرفة." },
  roomTasks: { en: "{n} tasks", ar: "{n} مهام" },
  addRoomFirst: { en: "Add a room to start organising tasks by room.", ar: "أضيفي غرفة لتنظيم المهام حسب الغرف." },
  // Children
  children: { en: "Children", ar: "الأطفال" },
  addChild: { en: "Add child", ar: "إضافة طفل" },
  childName: { en: "Child's name", ar: "اسم الطفل" },
  childInUse: { en: "Delete this child's routine items before removing them.", ar: "احذفي مهام روتين هذا الطفل قبل حذفه." },
  noChildren: { en: "Add a child to start their routine page.", ar: "أضيفي طفلاً لبدء صفحة روتينه." },
  backToKids: { en: "All children", ar: "كل الأطفال" },
  routine: { en: "Routine", ar: "الروتين" },
  // Repeating tasks
  skip: { en: "Skip this time", ar: "تخطي هذه المرة" },
  postponeTomorrow: { en: "Postpone to tomorrow", ar: "تأجيل إلى الغد" },
  postpone3: { en: "Postpone 3 days", ar: "تأجيل 3 أيام" },
  skipped: { en: "Skipped", ar: "تم التخطي" },
  postponedTo: { en: "Postponed to {date}", ar: "مؤجلة إلى {date}" },
  doneWord: { en: "Done", ar: "تم" },
  notToday: { en: "Not today", ar: "ليس اليوم" },
  history: { en: "History", ar: "السجل" },
  noHistory: { en: "No history yet.", ar: "لا يوجد سجل بعد." },
  checklist: { en: "Checklist (one step per line)", ar: "قائمة الخطوات (خطوة في كل سطر)" },
  steps_n: { en: "{a}/{b} steps", ar: "{a}/{b} خطوات" },
  days: { en: "Days", ar: "الأيام" },
  everyDay: { en: "Every day", ar: "كل يوم" },
  onlyChosenDays: { en: "Only on the chosen days", ar: "في الأيام المختارة فقط" },
  wd_sat: { en: "Sat", ar: "سبت" },
  wd_sun: { en: "Sun", ar: "أحد" },
  wd_mon: { en: "Mon", ar: "اثنين" },
  wd_tue: { en: "Tue", ar: "ثلاثاء" },
  wd_wed: { en: "Wed", ar: "أربعاء" },
  wd_thu: { en: "Thu", ar: "خميس" },
  wd_fri: { en: "Fri", ar: "جمعة" },
  homeProgress: { en: "Home is {p}% up to date", ar: "البيت محدّث بنسبة {p}٪" },
  upToDate: { en: "{a} of {b} up to date", ar: "{a} من {b} محدّثة" },
  remindMe: { en: "Remind me", ar: "ذكّريني" },
  reminderTime: { en: "Reminder time", ar: "وقت التذكير" },
  showInCalendar: { en: "Show in calendar", ar: "إظهار في التقويم" },
  moreActions: { en: "More for “{name}”", ar: "المزيد لـ «{name}»" },
  nextOn: { en: "Next: {date}", ar: "التالي: {date}" },
  // Budget
  overview: { en: "Overview", ar: "نظرة عامة" },
  transactions: { en: "Transactions", ar: "المعاملات" },
  goals: { en: "Savings goals", ar: "أهداف الادخار" },
  debts: { en: "Debts & installments", ar: "الديون والأقساط" },
  prevMonth: { en: "Previous month", ar: "الشهر السابق" },
  nextMonth: { en: "Next month", ar: "الشهر التالي" },
  monthlyIncome: { en: "Monthly income", ar: "الدخل الشهري" },
  setIncome: { en: "Set your monthly income to get a suggested plan.", ar: "حددي دخلك الشهري لتحصلي على خطة مقترحة." },
  extraIncome: { en: "Other income this month", ar: "دخل إضافي هذا الشهر" },
  leftToSpend: { en: "Left this month", ar: "المتبقي هذا الشهر" },
  planVsActual: { en: "Plan vs spent", ar: "المخطط مقابل المصروف" },
  planned: { en: "Planned", ar: "المخطط" },
  spentOf: { en: "{a} of {b}", ar: "{a} من {b}" },
  overBy: { en: "Over by {a}", ar: "تجاوز بمقدار {a}" },
  suggestPlan: { en: "Suggest a plan", ar: "اقترحي خطة" },
  suggestHistory: { en: "Based on your average spending over the last {n} months, keeping 15% for savings.", ar: "بناءً على متوسط مصروفك في آخر {n} أشهر، مع ادخار 15٪." },
  suggestDefault: { en: "A starting split of your income, keeping 15% for savings. It learns from your spending after two months.", ar: "تقسيم مبدئي لدخلك مع ادخار 15٪. يتعلم من مصروفك بعد شهرين." },
  applyPlan: { en: "Use this plan", ar: "استخدمي هذه الخطة" },
  savingsLeft: { en: "Left for savings: {a}", ar: "المتبقي للادخار: {a}" },
  lastMonths: { en: "Last 6 months", ar: "آخر 6 أشهر" },
  newGoal: { en: "New goal", ar: "هدف جديد" },
  target: { en: "Target", ar: "الهدف" },
  saved_amt: { en: "Saved", ar: "المدخر" },
  targetDate: { en: "Target date", ar: "تاريخ الهدف" },
  addMoney: { en: "Add money", ar: "إضافة مبلغ" },
  newDebt: { en: "New debt or installment", ar: "دين أو قسط جديد" },
  totalOwed: { en: "Total owed", ar: "إجمالي الدين" },
  monthlyPayment: { en: "Monthly payment", ar: "القسط الشهري" },
  dueDay: { en: "Due day of month", ar: "يوم الاستحقاق من الشهر" },
  remaining: { en: "Remaining {a}", ar: "المتبقي {a}" },
  monthsLeft: { en: "{n} months left", ar: "متبقي {n} أشهر" },
  recordPayment: { en: "Record payment", ar: "تسجيل دفعة" },
  paidOff: { en: "Paid off", ar: "تم السداد" },
  paymentFor: { en: "Payment: {name}", ar: "دفعة: {name}" },
  // Sign-in
  signInGoogle: { en: "Sign in with your Google account to open your space.", ar: "سجّلي الدخول بحساب Google لفتح مساحتك." },
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
