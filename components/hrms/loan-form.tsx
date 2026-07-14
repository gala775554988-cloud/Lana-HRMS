"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Calculator, Loader2, Search, X } from "lucide-react";
import { createModuleRecord, updateModuleRecord } from "@/lib/hrms/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Dictionary, Locale } from "@/lib/i18n";

type EmployeeMatch = {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  nationalId: string;
  department?: { name: string } | null;
};

const statusOptions = [
  { value: "ACTIVE", label: "نشط" },
  { value: "PAID", label: "مسدد" },
  { value: "DEFAULTED", label: "متعثر" },
  { value: "CANCELLED", label: "ملغي" }
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Bespoke create/edit form for the "loans" module -- mirrors the real
 * workflow (employee lookup, amount, installment count, calculate
 * installment, submit) instead of the generic ModuleForm, which only
 * offered a raw-text employeeId (cuid) field. The actual Odoo push for
 * approved loans is intentionally not wired here yet -- see TODO below.
 */
export function LoanForm({ dictionary: _dictionary, locale = "ar", initialValues, recordId }: { dictionary: Dictionary; locale?: Locale; initialValues?: Record<string, unknown>; recordId?: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [isPending, startTransition] = useTransition();

  const [employeeQuery, setEmployeeQuery] = useState("");
  const [employeeResults, setEmployeeResults] = useState<EmployeeMatch[]>([]);
  const [employeeId, setEmployeeId] = useState(String(initialValues?.employeeId ?? ""));
  const [employeeLabel, setEmployeeLabel] = useState("");
  const [showResults, setShowResults] = useState(false);

  const [loanNumber, setLoanNumber] = useState(String(initialValues?.loanNumber ?? ""));
  const [principalAmount, setPrincipalAmount] = useState(String(initialValues?.principalAmount ?? ""));
  const [termMonths, setTermMonths] = useState("1");
  const [installmentAmount, setInstallmentAmount] = useState(String(initialValues?.installmentAmount ?? ""));
  const [currency, setCurrency] = useState(String(initialValues?.currency ?? "SAR"));
  const [issuedAt, setIssuedAt] = useState(initialValues?.issuedAt ? String(initialValues.issuedAt).slice(0, 10) : todayIso());
  const [status, setStatus] = useState(String(initialValues?.status ?? "ACTIVE"));
  const [notes, setNotes] = useState(String(initialValues?.notes ?? ""));

  useEffect(() => {
    const trimmed = employeeQuery.trim();
    if (trimmed.length < 2) {
      setEmployeeResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/employees/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then((response) => response.json())
        .then((data) => setEmployeeResults(data.success ? data.employees ?? [] : []))
        .catch(() => {});
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [employeeQuery]);

  const calculatedInstallment = useMemo(() => {
    const principal = Number(principalAmount);
    const months = Number(termMonths);
    if (!principal || !months) return null;
    return Math.round((principal / months) * 100) / 100;
  }, [principalAmount, termMonths]);

  function applyCalculatedInstallment() {
    if (calculatedInstallment !== null) setInstallmentAmount(String(calculatedInstallment));
  }

  function selectEmployee(employee: EmployeeMatch) {
    setEmployeeId(employee.id);
    setEmployeeLabel(`${employee.firstName} ${employee.lastName} (${employee.employeeNumber})`);
    setEmployeeQuery("");
    setEmployeeResults([]);
    setShowResults(false);
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (!employeeId) {
      setMessage({ text: "الرجاء اختيار الموظف من نتائج البحث.", type: "error" });
      return;
    }
    const principal = Number(principalAmount);
    const installment = Number(installmentAmount || calculatedInstallment || 0);
    const values = {
      employeeId,
      loanNumber,
      principalAmount: principal,
      outstandingAmount: recordId ? Number(initialValues?.outstandingAmount ?? principal) : principal,
      installmentAmount: installment,
      currency,
      issuedAt,
      status,
      notes
    };

    startTransition(async () => {
      const result = recordId
        ? await updateModuleRecord({ resourceKey: "loans", id: recordId, values })
        : await createModuleRecord({ resourceKey: "loans", values });
      if (result.success) {
        setMessage({ text: result.message, type: "success" });
        router.refresh();
      } else {
        setMessage({ text: result.message || "فشل في حفظ السلفة", type: "error" });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" dir={locale === "ar" ? "rtl" : "ltr"}>
      {message ? (
        <Alert className={message.type === "success" ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30" : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30"}>
          <div className="flex items-start gap-2">
            {message.type === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />}
            <AlertDescription className={message.type === "success" ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}>{message.text}</AlertDescription>
          </div>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label>الموظف<span className="me-1 text-destructive">*</span></Label>
        {employeeLabel ? (
          <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
            <span>{employeeLabel}</span>
            <button type="button" onClick={() => { setEmployeeId(""); setEmployeeLabel(""); }} className="text-muted-foreground hover:text-foreground" aria-label="إزالة"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={employeeQuery}
              onChange={(event) => { setEmployeeQuery(event.target.value); setShowResults(true); }}
              onFocus={() => setShowResults(true)}
              placeholder="ابحث بالاسم، الرقم الوظيفي، أو رقم الهوية..."
              className="ps-9"
            />
            {showResults && employeeResults.length > 0 ? (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md">
                {employeeResults.map((employee) => (
                  <button
                    key={employee.id}
                    type="button"
                    onClick={() => selectEmployee(employee)}
                    className="flex w-full flex-col items-start px-3 py-2 text-start text-sm hover:bg-accent"
                  >
                    <span className="font-medium">{employee.firstName} {employee.lastName}</span>
                    <span className="text-xs text-muted-foreground">{employee.employeeNumber} · {employee.department?.name ?? "-"}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="loanNumber">رقم السلفة<span className="me-1 text-destructive">*</span></Label>
          <Input id="loanNumber" value={loanNumber} onChange={(event) => setLoanNumber(event.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="issuedAt">التاريخ<span className="me-1 text-destructive">*</span></Label>
          <Input id="issuedAt" type="date" value={issuedAt} onChange={(event) => setIssuedAt(event.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="principalAmount">مبلغ السلفة<span className="me-1 text-destructive">*</span></Label>
          <Input id="principalAmount" type="number" step="0.01" value={principalAmount} onChange={(event) => setPrincipalAmount(event.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="termMonths">عدد الأقساط<span className="me-1 text-destructive">*</span></Label>
          <Input id="termMonths" type="number" min="1" value={termMonths} onChange={(event) => setTermMonths(event.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="installmentAmount">قيمة القسط الشهري</Label>
          <div className="flex gap-2">
            <Input id="installmentAmount" type="number" step="0.01" value={installmentAmount} onChange={(event) => setInstallmentAmount(event.target.value)} />
            <Button type="button" variant="outline" size="icon" onClick={applyCalculatedInstallment} disabled={calculatedInstallment === null} aria-label="احتساب القسط" title="احتساب القسط">
              <Calculator className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="currency">العملة</Label>
          <Input id="currency" value={currency} onChange={(event) => setCurrency(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">الحالة</Label>
          <select id="status" value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">ملاحظات</Label>
        <textarea id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
        {recordId ? "حفظ التعديلات" : "إنشاء السلفة"}
      </Button>
    </form>
  );
}
