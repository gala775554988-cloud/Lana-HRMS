"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, KeyRound, Users, AlertTriangle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

type Employee = {
  id: string;
  employeeNumber: string;
  nationalId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  status: string;
  department?: { name: string } | null;
  user?: { id: string; mustChangePassword: boolean; passwordChanged: boolean; lastPasswordResetAt: string | null } | null;
};

export default function PasswordManagementClient({ totalEmployees }: { totalEmployees: number }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<any>(null);
  const [showConfirm, setShowConfirm] = useState<"single" | "multiple" | "all" | null>(null);
  const [confirmEmployee, setConfirmEmployee] = useState<Employee | null>(null);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("take", "100");
      if (search) params.set("search", search);
      const res = await fetch(`/api/employees/list-for-password?${params.toString()}`);
      const json = await res.json();
      if (json.success) setEmployees(json.employees);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => { fetchEmployees(); }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [fetchEmployees]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchEmployees();
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selected);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelected(newSet);
  };

  const toggleSelectAll = () => {
    if (selected.size === employees.length) setSelected(new Set());
    else setSelected(new Set(employees.map((e) => e.id)));
  };

  const resetSingle = async (emp: Employee) => {
    setConfirmEmployee(emp);
    setShowConfirm("single");
  };

  const confirmResetSingle = async () => {
    if (!confirmEmployee) return;
    setLoading(true);
    try {
      const res = await fetch("/api/employees/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: confirmEmployee.id }),
      });
      const json = await res.json();
      setResult(json);
      if (json.success) fetchEmployees();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setShowConfirm(null);
      setConfirmEmployee(null);
    }
  };

  const confirmResetMultiple = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/employees/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeIds: Array.from(selected) }),
      });
      const json = await res.json();
      setResult(json);
      if (json.success) {
        setSelected(new Set());
        fetchEmployees();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setShowConfirm(null);
    }
  };

  const confirmResetAll = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/employees/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetAll: true }),
      });
      const json = await res.json();
      setResult(json);
      if (json.success) {
        setSelected(new Set());
        fetchEmployees();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setShowConfirm(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" />إدارة كلمات المرور</CardTitle>
          <CardDescription>
            إعادة تعيين كلمة المرور إلى آخر 4 أرقام من رقم الهوية. سيُجبر الموظف على تغييرها عند أول دخول.
            <br />
            <span className="text-red-600 font-bold">تحذير: هذه العملية ستعيد كلمة المرور إلى الافتراضية (آخر 4 أرقام) وستجبر الموظف على تغييرها.</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            <form onSubmit={handleSearch} className="flex gap-2 flex-1 max-w-md">
              <Input placeholder="بحث: اسم، رقم وظيفي، هوية..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <Button type="submit" size="sm"><Search className="h-4 w-4" /></Button>
            </form>
            <Button variant="outline" size="sm" onClick={() => setSelected(new Set(employees.map((e) => e.id)))}>تحديد الكل ({employees.length})</Button>
            <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>إلغاء التحديد</Button>
            <Button variant="destructive" size="sm" disabled={selected.size === 0 || loading} onClick={() => setShowConfirm("multiple")}>
              إعادة تعيين المحدد ({selected.size})
            </Button>
            <Button variant="destructive" size="sm" disabled={loading} onClick={() => setShowConfirm("all")} className="bg-red-700 hover:bg-red-800">
              إعادة تعيين جميع الموظفين ({totalEmployees})
            </Button>
          </div>

          {result && (
            <div className={`p-4 rounded-lg mb-4 ${result.success ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
              <div className="font-bold">{result.message}</div>
              <div className="text-sm mt-1">تم: {result.resetCount} | تم تخطيه: {result.skippedCount} | إجمالي: {result.total}</div>
              {result.errors && result.errors.length > 0 && (
                <div className="mt-2 text-xs">
                  <strong>أخطاء:</strong>
                  <ul className="list-disc pr-5">
                    {result.errors.slice(0, 5).map((err: any, i: number) => (
                      <li key={i}>{err.name || err.id}: {err.reason || err.error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {loading ? (
            <div className="p-8 text-center">جاري التحميل...</div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60"><tr>
                  <th className="px-3 py-2 text-right"><input type="checkbox" checked={selected.size === employees.length && employees.length > 0} onChange={toggleSelectAll} /></th>
                  <th className="px-3 py-2 text-right">الاسم</th>
                  <th className="px-3 py-2 text-right">الرقم الوظيفي</th>
                  <th className="px-3 py-2 text-right">رقم الهوية</th>
                  <th className="px-3 py-2 text-right">القسم</th>
                  <th className="px-3 py-2 text-right">كلمة المرور</th>
                  <th className="px-3 py-2 text-right">آخر تغيير</th>
                  <th className="px-3 py-2 text-right">إجراء</th>
                </tr></thead>
                <tbody className="divide-y">
                  {employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-muted/40">
                      <td className="px-3 py-2"><input type="checkbox" checked={selected.has(emp.id)} onChange={() => toggleSelect(emp.id)} /></td>
                      <td className="px-3 py-2 font-medium">{emp.firstName} {emp.lastName}</td>
                      <td className="px-3 py-2 font-mono">{emp.employeeNumber}</td>
                      <td className="px-3 py-2 font-mono">{emp.nationalId}</td>
                      <td className="px-3 py-2">{emp.department?.name || "-"}</td>
                      <td className="px-3 py-2">
                        {emp.user ? (
                          <span className={`rounded-full px-2 py-1 text-xs ${emp.user.mustChangePassword ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>
                            {emp.user.mustChangePassword ? "افتراضية (يجب تغييرها)" : "تم تغييرها"}
                          </span>
                        ) : (
                          <span className="rounded-full bg-red-100 px-2 py-1 text-xs text-red-800">لا يوجد حساب</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">{emp.user?.lastPasswordResetAt ? new Date(emp.user.lastPasswordResetAt).toLocaleDateString("ar-SA") : "-"}</td>
                      <td className="px-3 py-2">
                        <Button size="sm" variant="outline" onClick={() => resetSingle(emp)} className="h-8 text-xs">
                          <KeyRound className="h-3 w-3 ml-1" />إعادة تعيين
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm Dialogs */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600"><AlertTriangle className="h-5 w-5" />تأكيد إعادة التعيين</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {showConfirm === "single" && confirmEmployee && (
                <p>هل أنت متأكد من إعادة تعيين كلمة مرور الموظف <strong>{confirmEmployee.firstName} {confirmEmployee.lastName}</strong> ({confirmEmployee.nationalId}) إلى آخر 4 أرقام <strong>{confirmEmployee.nationalId.slice(-4)}</strong>؟</p>
              )}
              {showConfirm === "multiple" && (
                <p>هل أنت متأكد من إعادة تعيين كلمات مرور <strong>{selected.size}</strong> موظف إلى آخر 4 أرقام من هوياتهم؟</p>
              )}
              {showConfirm === "all" && (
                <p className="text-red-700 font-bold">هل أنت متأكد من إعادة تعيين كلمات مرور <strong>جميع الموظفين ({totalEmployees})</strong> إلى آخر 4 أرقام؟ هذه العملية ستجبر الجميع على تغيير كلمة المرور عند أول دخول!</p>
              )}
              <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800">
                سيتم تسجيل هذه العملية في Audit Log مع اسم من قام بها ومتى ولأي موظف.
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setShowConfirm(null); setConfirmEmployee(null); }}>إلغاء</Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (showConfirm === "single") confirmResetSingle();
                    else if (showConfirm === "multiple") confirmResetMultiple();
                    else if (showConfirm === "all") confirmResetAll();
                  }}
                >
                  تأكيد إعادة التعيين
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
