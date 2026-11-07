import Link from "next/link";
import { ArrowUpLeft, Bell, Globe, KeyRound, Monitor, UserRound, Image } from "lucide-react";
import { getRequestDictionary } from "@/lib/i18n-server";

const settings = [
  { path: "account", icon: UserRound, ar: ["بيانات الحساب", "راجع اسم الدخول وبياناتك الوظيفية."], en: ["Account details", "Review your sign-in name and employment details."] },
  { path: "password", icon: KeyRound, ar: ["كلمة المرور", "حدّث كلمة مرور حسابك."], en: ["Password", "Change your account password."] },
  { path: "notifications", icon: Bell, ar: ["الإشعارات", "افتح مركز الإشعارات وتابع آخر المستجدات."], en: ["Notifications", "Open your notification center and see recent updates."] },
  { path: "profile-picture", icon: Image, ar: ["الصورة الشخصية", "خصّص الصورة الظاهرة في حسابك."], en: ["Profile picture", "Choose the picture shown on your account."] },
  { path: "language", icon: Globe, ar: ["اللغة", "اختر لغة الواجهة."], en: ["Language", "Choose your interface language."] },
  { path: "theme", icon: Monitor, ar: ["المظهر", "اختر المظهر الأنسب لك."], en: ["Appearance", "Choose a theme that works for you."] },
] as const;

export async function EmployeeSettingsPortal() {
  const { locale } = await getRequestDictionary();
  const arabic = locale === "ar";

  return (
    <section className="space-y-6">
      <header className="lana-workspace-hero rounded-3xl p-6 sm:p-9">
        <p className="text-sm font-semibold text-indigo-200">{arabic ? "مساحتي في Lana" : "My Lana workspace"}</p>
        <h1 className="mt-2 text-3xl sm:text-4xl">{arabic ? "إعدادات حسابي" : "My account settings"}</h1>
        <p className="mt-3 max-w-lg text-sm text-slate-200">
          {arabic ? "كل ما يخص حسابك وتفضيلاتك في مكان واحد." : "Your account and preferences, all in one place."}
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {settings.map(({ path, icon: Icon, ar, en }) => {
          const [title, description] = arabic ? ar : en;
          return (
            <Link key={path} href={`/employee/settings/${path}`} className="lana-card group flex flex-col items-start gap-4 p-5">
              <div className="flex w-full items-center justify-between">
                <span className="rounded-xl bg-primary/10 p-3 text-primary"><Icon aria-hidden className="h-5 w-5" /></span>
                <ArrowUpLeft aria-hidden className="h-4 w-4 text-muted-foreground group-hover:text-primary ltr:rotate-90" />
              </div>
              <div>
                <h2 className="text-base font-bold">{title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
