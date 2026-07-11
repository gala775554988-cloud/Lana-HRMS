"use client";

import { useState } from "react";
import { Wallet, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  salaryProfile: any;
  salaryFields: string[];
  salaryLabels: Record<string, string>;
  locale?: string;
}

export function EmployeeSalaryButton({ salaryProfile, salaryFields, salaryLabels, locale = "ar" }: Props) {
  const [open, setOpen] = useState(false);

  // Calculate total salary
  const total = (() => {
    if (!salaryProfile) return 0;
    let sum = 0;
    // Try to find base salary and allowances
    for (const field of salaryFields) {
      const val = salaryProfile[field];
      if (typeof val === "number") sum += val;
      else if (typeof val === "string" && !isNaN(Number(val))) sum += Number(val);
    }
    // Also check salaryCosts
    if (Array.isArray(salaryProfile.salaryCosts)) {
      for (const cost of salaryProfile.salaryCosts) {
        if (typeof cost === "number") sum += cost;
        else if (typeof cost === "object" && cost.amount) sum += Number(cost.amount) || 0;
      }
    }
    return sum;
  })();

  const display = (value: any) => {
    if (value === null || value === undefined || value === "") return "-";
    if (typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch {
        return "-";
      }
    }
    return String(value);
  };

  return (
    <>
      <div className="rounded-md border p-3 bg-green-50/30 dark:bg-green-950/10 sm:col-span-2">
        <p className="text-xs uppercase text-muted-foreground flex items-center gap-1">
          <Wallet className="h-3 w-3" /> الراتب الإجمالي
        </p>
        <div className="mt-1 flex items-center justify-between">
          <p className="text-lg font-bold text-green-700 dark:text-green-400">
            {total > 0 ? `${total.toLocaleString("ar-SA")} SAR` : "غير محدد"}
          </p>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-1.5">
            <Eye className="h-3.5 w-3.5" />
            {locale === "ar" ? "عرض التفاصيل" : "View Details"}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">اضغط لعرض تفاصيل الراتب والبدلات والخصومات - مخفي لحماية الخصوصية</p>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تفاصيل الراتب</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border p-3 bg-green-50 dark:bg-green-950/20">
              <p className="text-xs uppercase text-muted-foreground">الإجمالي</p>
              <p className="text-xl font-bold text-green-700">{total > 0 ? `${total.toLocaleString()} SAR` : "-"}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase text-muted-foreground">خصم التأمينات</p>
              <p className="text-lg font-semibold">{salaryProfile?.salaryDeductInsurance ? "مفعل" : "غير مفعل"}</p>
            </div>
            {(salaryProfile?.salaryCosts ?? []).map((cost: any, index: number) => (
              <div key={`cost-${index}`} className="rounded-md border p-3">
                <p className="text-xs uppercase text-muted-foreground">{index === 0 ? "التكلفة" : `التكلفة ${index + 1}`}</p>
                <p className="text-lg font-semibold">{display(cost)}</p>
              </div>
            ))}
            {salaryFields.map((field) => (
              <div key={field} className="rounded-md border p-3">
                <p className="text-xs uppercase text-muted-foreground">{salaryLabels[field] || field}</p>
                <p className="text-lg font-semibold">{display(salaryProfile?.[field])}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
