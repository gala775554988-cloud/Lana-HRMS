"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  ShieldCheck,
  User,
  Mail,
  CheckCircle2,
} from "lucide-react";
import { Label } from "@/components/ui/label";

type Employee = {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  user: {
    username: string | null;
    loginEmail: string | null;
    isActive: boolean;
    employeePasswordMode: string;
  } | null;
};
export function EmployeeAccountManagement({
  initialEmployeeId,
}: { initialEmployeeId?: string } = {}) {
  const selectedId = useRef<string | null>(null);
  const [search, setSearch] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [active, setActive] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const choose = useCallback((employee: Employee) => {
    selectedId.current = employee.id;
    setSelected(employee);
    setUsername(employee.user?.username || "");
    setEmail(employee.user?.loginEmail || "");
    setActive(employee.user?.isActive ?? true);
    setPassword("");
    setMessage("");
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(
      async () => {
        try {
          const params = new URLSearchParams({ take: "30", search });
          if (initialEmployeeId) params.set("employeeId", initialEmployeeId);
          const response = await fetch(
            `/api/employees/list-for-password?${params}`,
            { signal: controller.signal, cache: "no-store" },
          );
          const result = await response.json();
          if (!response.ok || !result.success)
            throw new Error(result.message || "تعذر تحميل الموظفين.");
          setEmployees(result.employees);
          if (
            initialEmployeeId &&
            selectedId.current !== initialEmployeeId &&
            result.employees[0]
          )
            choose(result.employees[0]);
        } catch (error) {
          if (!controller.signal.aborted)
            setMessage(
              error instanceof Error ? error.message : "تعذر تحميل الموظفين.",
            );
        }
      },
      initialEmployeeId ? 0 : 300,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, refresh, initialEmployeeId, choose]);

  async function save(extra: Record<string, unknown> = {}) {
    if (!selected || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/employees/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: selected.id,
          ...(username ? { username } : {}),
          ...(email ? { email } : {}),
          isActive: active,
          ...(password ? { password } : {}),
          ...extra,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(result.message || "تعذر تحديث الحساب.");
      setMessage(result.message);
      setPassword("");
      setRefresh((value) => value + 1);
      if (extra.clearLoginEmail) setEmail("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تحديث الحساب.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="overflow-hidden rounded-2xl border bg-card shadow-sm"
      aria-labelledby="account-management-title"
    >
      <header className="border-b bg-gradient-to-l from-indigo-50/80 to-card p-5 dark:from-indigo-950/30 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-indigo-600 text-white shadow-sm">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <div>
            <p className="mb-1 text-[10px] font-semibold tracking-widest text-indigo-600 dark:text-indigo-300">
              وصول آمن للموظفين
            </p>
            <h2 id="account-management-title" className="text-lg font-bold">
              إدارة الحساب
            </h2>
            <p className="mt-2 max-w-3xl text-xs leading-6 text-muted-foreground">
              يدخل الموظف برقم الهوية وآخر أربعة أرقام، ثم البصمة أو رمز قفل الجهاز.
            </p>
          </div>
        </div>
        <ol className="mt-5 grid gap-3 text-xs sm:grid-cols-3">
          {[
            "اختر الموظف",
            "راجع بيانات الحساب",
            "احفظ التغييرات",
          ].map((step, index) => (
            <li
              key={step}
              className="flex items-center gap-2 rounded-xl border bg-card/80 p-3"
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-indigo-50 text-[11px] font-bold text-indigo-600 dark:bg-indigo-950">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </header>
      <div
        className={`grid ${initialEmployeeId ? "" : "lg:grid-cols-[minmax(240px,.7fr)_minmax(0,1.7fr)]"}`}
      >
        {!initialEmployeeId ? (
          <aside className="space-y-4 border-b bg-muted/20 p-5 lg:border-b-0 lg:border-e">
            <Label htmlFor="account-search" className="text-xs">
              البحث عن موظف
            </Label>
            <div className="relative">
              <Search className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="account-search"
                placeholder="الاسم، الرقم الوظيفي أو الهوية…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="rounded-xl ps-9"
              />
            </div>
            <div
              className="max-h-[460px] space-y-2 overflow-y-auto"
              aria-label="نتائج البحث"
            >
              {employees.map((employee) => (
                <button
                  key={employee.id}
                  type="button"
                  disabled={busy}
                  onClick={() => choose(employee)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-start transition ${selected?.id === employee.id ? "border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950/30" : "border-transparent hover:bg-card"}`}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-card text-indigo-600">
                    <User className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold leading-6">
                      {employee.firstName} {employee.lastName}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      رقم الموظف · {employee.employeeNumber}
                    </span>
                  </span>
                  {selected?.id === employee.id ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-600" />
                  ) : null}
                </button>
              ))}
              {!employees.length ? (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  لا توجد نتائج مطابقة.
                </p>
              ) : null}
            </div>
          </aside>
        ) : null}
        <div className="min-w-0 p-5 sm:p-6">
          {selected ? (
            <>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold">
                    {selected.firstName} {selected.lastName}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    بيانات الحساب · {selected.employeeNumber}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold ${active ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800"}`}
                >
                  {active ? "الحساب مفعل" : "الحساب موقوف"}
                </span>
              </div>
              <form
                className="grid gap-5 sm:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void save();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="account-username" className="text-xs">
                    اسم المستخدم
                  </Label>
                  <Input
                    id="account-username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    maxLength={64}
                    autoComplete="off"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="account-email"
                    className="flex items-center gap-1 text-xs"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    بريد التواصل (اختياري، لا يستخدم للدخول)
                  </Label>
                  <Input
                    id="account-email"
                    type="email"
                    dir="ltr"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="لم يُسجّل بعد"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account-password" className="text-xs">
                    كلمة مرور جديدة (اختياري)
                  </Label>
                  <Input
                    id="account-password"
                    type="password"
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                    placeholder="12 خانة على الأقل"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="rounded-xl"
                  />
                  <p className="text-[11px] leading-5 text-muted-foreground">
                    تُستخدم بدلاً من آخر 4 أرقام، ثم البصمة أو رمز قفل الجهاز.
                  </p>
                </div>
                <div className="flex items-center">
                  <label className="flex w-full items-center gap-3 rounded-xl border p-4 text-xs">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={(event) => setActive(event.target.checked)}
                      className="h-4 w-4 accent-indigo-600"
                    />
                    السماح للموظف بالدخول
                  </label>
                </div>
                <div className="flex flex-wrap gap-2 border-t pt-4 sm:col-span-2">
                  <Button disabled={busy} type="submit" className="rounded-xl">
                    {busy ? "جارٍ الحفظ…" : "حفظ بيانات الحساب"}
                  </Button>
                  <Button
                    disabled={busy}
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => {
                      if (
                        confirm(
                          "العودة إلى آخر أربعة أرقام من الهوية وإلغاء الجلسات السابقة؟",
                        )
                      )
                        void save({
                          restoreIdentityPassword: true,
                          password: undefined,
                        });
                    }}
                  >
                    استعادة آخر 4 أرقام
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <div className="grid min-h-64 place-items-center text-center">
              <div>
                <User className="mx-auto mb-4 h-10 w-10 text-muted-foreground/40" />
                <h3 className="text-sm font-semibold">
                  اختر الموظف لإدارة حسابه
                </h3>
                <p className="mt-2 text-xs text-muted-foreground">
                  ستظهر هنا بيانات الحساب وخيارات تعديله.
                </p>
              </div>
            </div>
          )}
          {message ? (
            <p
              role="status"
              className="mt-5 rounded-xl border bg-muted/40 p-4 text-xs leading-6"
            >
              {message}
            </p>
          ) : null}

        </div>
      </div>
    </section>
  );
}
