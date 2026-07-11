"use client";

import { useState, useTransition } from "react";
import { Archive, Download, Edit3, Printer, RotateCcw, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  employeeId: string;
  userId?: string | null;
  isArchived?: boolean;
  pdfHref: string;
  editHref: string;
};

export function EmployeeProfileActions({ employeeId, userId, isArchived, pdfHref, editHref }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function runAccountAction(action: string) {
    if (!userId) {
      setMessage("لا يوجد حساب مستخدم مرتبط بهذا الموظف.");
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/enterprise/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        setMessage(data?.message ?? "تعذر تنفيذ العملية");
        return;
      }
      setMessage(data.generatedPassword ? `تمت إعادة التعيين. كلمة المرور المؤقتة: ${data.generatedPassword}` : "تم تنفيذ العملية بنجاح");
    });
  }

  function runEmployeeAction(action: string) {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/enterprise/employees/${employeeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        setMessage(data?.message ?? "تعذر تنفيذ العملية");
        return;
      }
      setMessage("تم تحديث حالة الموظف بنجاح");
      setTimeout(() => window.location.reload(), 700);
    });
  }

  return (
    <div className="space-y-2 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" disabled={isPending || !userId} onClick={() => runAccountAction("reset-password")}>
          <KeyRound className="ms-2 h-4 w-4" /> إعادة تعيين كلمة المرور
        </Button>
        <Button variant={isArchived ? "outline" : "destructive"} disabled={isPending} onClick={() => runEmployeeAction(isArchived ? "restore-employee" : "archive-employee")}>
          {isArchived ? <RotateCcw className="ms-2 h-4 w-4" /> : <Archive className="ms-2 h-4 w-4" />}
          {isArchived ? "استعادة" : "أرشفة"}
        </Button>
        <Button asChild variant="outline">
          <a href={pdfHref}><Download className="ms-2 h-4 w-4" /> PDF</a>
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="ms-2 h-4 w-4" /> طباعة
        </Button>
        <Button asChild variant="outline">
          <a href={editHref}><Edit3 className="ms-2 h-4 w-4" /> تعديل</a>
        </Button>
      </div>
      {message ? <div className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">{message}</div> : null}
    </div>
  );
}
