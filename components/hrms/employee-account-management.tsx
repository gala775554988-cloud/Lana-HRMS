"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Employee = {
  id: string; employeeNumber: string; firstName: string; lastName: string;
  user: { username: string | null; loginEmail: string | null; isActive: boolean; employeePasswordMode: string } | null;
};
export function EmployeeAccountManagement() {
  const [search, setSearch] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [active, setActive] = useState(true);
  const [message, setMessage] = useState("");
  const [activation, setActivation] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/employees/list-for-password?take=30&search=${encodeURIComponent(search)}`, { signal: controller.signal, cache: "no-store" });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "تعذر تحميل الموظفين.");
        setEmployees(result.employees);
      } catch (error) { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "تعذر تحميل الموظفين."); }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, refresh]);

  function choose(employee: Employee) {
    setSelected(employee); setUsername(employee.user?.username || ""); setEmail(employee.user?.loginEmail || "");
    setActive(employee.user?.isActive ?? true); setPassword(""); setActivation(""); setMessage("");
  }
  async function save(extra: Record<string, unknown> = {}) {
    if (!selected || busy) return;
    setBusy(true); setMessage(""); setActivation("");
    const issueOnly = extra.issueActivation === true;
    try {
      const response = await fetch("/api/employees/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        employeeId: selected.id,
        ...(!issueOnly ? { ...(username ? { username } : {}), ...(email ? { email } : {}), isActive: active, ...(password ? { password } : {}) } : {}),
        ...extra,
      }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "تعذر تحديث الحساب.");
      setMessage(result.message); setPassword(""); setRefresh(value => value + 1);
      if (extra.clearLoginEmail) setEmail("");
      if (result.activationCode) setActivation(result.activationCode);
    } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر تحديث الحساب."); }
    finally { setBusy(false); }
  }
  return (
    <section className="space-y-5 rounded-2xl border bg-card p-6 shadow-sm" aria-labelledby="account-management-title">
      <div><h2 id="account-management-title" className="text-xl font-bold">إدارة حسابات الموظفين وبريد الدخول</h2>
        <p className="mt-2 text-sm text-muted-foreground">عدّل الحساب أو أوقفه، وحدد بريد التحقق وكلمة المرور، أو أصدر رمز تفعيل للموظف ليسجل بريده بنفسه لأول مرة.</p></div>
      <Label htmlFor="account-search">البحث بالاسم أو رقم الموظف أو الهوية</Label>
      <Input id="account-search" value={search} onChange={event => setSearch(event.target.value)} />
      <div className="max-h-60 space-y-2 overflow-y-auto" aria-label="نتائج البحث">
        {employees.map(employee => <Button key={employee.id} type="button" variant={selected?.id === employee.id ? "default" : "outline"} disabled={busy} onClick={() => choose(employee)} className="me-2 mb-2">{employee.firstName} {employee.lastName} · {employee.employeeNumber}</Button>)}
        {!employees.length ? <p className="text-sm text-muted-foreground">لا توجد نتائج مطابقة.</p> : null}
      </div>
      {selected ? <form className="grid gap-4 md:grid-cols-2" onSubmit={event => { event.preventDefault(); void save(); }}>
        <div><Label htmlFor="account-username">اسم المستخدم</Label><Input id="account-username" value={username} onChange={event => setUsername(event.target.value)} maxLength={64} autoComplete="off" /></div>
        <div><Label htmlFor="account-email">بريد الدخول والتحقق</Label><Input id="account-email" type="email" dir="ltr" value={email} onChange={event => setEmail(event.target.value)} /></div>
        <div><Label htmlFor="account-password">كلمة مرور جديدة (اختياري، 12 خانة على الأقل)</Label><Input id="account-password" type="password" minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} /><p className="text-xs text-muted-foreground">عند تعيينها تستخدم بدلاً من آخر 4 أرقام، ويبقى رمز البريد إلزامياً.</p></div>
        <label className="flex items-center gap-2"><input type="checkbox" checked={active} onChange={event => setActive(event.target.checked)} />الحساب مفعل</label>
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <Button disabled={busy} type="submit">حفظ بيانات الحساب</Button>
          <Button disabled={busy} type="button" variant="outline" onClick={() => { if (confirm("العودة إلى آخر أربعة أرقام من الهوية وإلغاء الجلسات السابقة؟")) void save({ restoreIdentityPassword: true, password: undefined }); }}>استعادة آخر 4 أرقام</Button>
          <Button disabled={busy} type="button" variant="outline" onClick={() => { if (confirm("إلغاء بريد الدخول السابق وإصدار رمز تفعيل جديد؟ سلّم الرمز للموظف بعد التحقق من هويته.")) void save({ clearLoginEmail: true, email: undefined, issueActivation: true }); }}>إصدار رمز تفعيل / إعادة تسجيل البريد</Button>
        </div>
      </form> : null}
      {message ? <p role="status" className="rounded-lg bg-muted p-3 text-sm">{message}</p> : null}
      {activation ? <div className="space-y-2 rounded-xl border p-4"><p className="font-semibold">رمز التفعيل — صالح 7 أيام ويستخدم مرة واحدة</p><p className="text-sm">سلّمه للموظف بعد التأكد من هويته. لا تشاركه مع غيره؛ لن يظهر مجدداً بعد مغادرة الصفحة.</p><Input aria-label="رمز التفعيل" value={activation} readOnly dir="ltr" /><Button type="button" variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(activation); setMessage("تم نسخ رمز التفعيل."); } catch { setMessage("تعذر النسخ التلقائي؛ انسخ الرمز من الحقل."); } }}>نسخ رمز التفعيل</Button></div> : null}
    </section>
  );
}
