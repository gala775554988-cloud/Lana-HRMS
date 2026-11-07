import { getCurrentEmployeeCached } from "@/lib/employee/employee-cache";
import { getRequestDictionary } from "@/lib/i18n-server";

export default async function AccountSettings() {
  const [employee, { locale }] = await Promise.all([getCurrentEmployeeCached(), getRequestDictionary()]);
  const arabic = locale === "ar";
  const fields = [
    [arabic ? "الاسم" : "Name", [employee?.firstName, employee?.lastName].filter(Boolean).join(" ")],
    [arabic ? "اسم الدخول" : "Sign-in name", employee?.user?.username],
    [arabic ? "بريد الدخول" : "Sign-in email", employee?.user?.email],
    [arabic ? "رقم الموظف" : "Employee number", employee?.employeeNumber],
    [arabic ? "القسم" : "Department", employee?.department?.name],
    [arabic ? "المسمى الوظيفي" : "Job title", employee?.position?.title],
    [arabic ? "الفرع" : "Branch", employee?.branch?.name],
  ];

  return (
    <section aria-labelledby="account-heading" className="lana-card p-5 sm:p-8">
      <h1 id="account-heading" className="text-2xl">{arabic ? "بيانات حسابي" : "My account details"}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {arabic ? "لتصحيح بيانات حسابك أو ملفك الوظيفي، تواصل مع الموارد البشرية." : "Contact HR to correct your account or employment details."}
      </p>
      <dl className="mt-6 grid gap-3 sm:grid-cols-2">
        {fields.map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-xl border bg-muted/40 p-4">
            <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
            <dd className="mt-1 break-words text-sm font-semibold" dir="auto">{value || "—"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
