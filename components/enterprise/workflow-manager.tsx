"use client";

import React, { useState, useTransition } from "react";
import { ChevronDown, Plus, X, CheckCircle2, Shield, UserCheck, Loader2, GitPullRequest, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UserSearchSelect } from "@/components/hrms/user-search-select";

export type WorkflowStepItem = {
  id: number | string;
  name: string;
  role: string;
  approverIdentifier?: string;
  approverLabel?: string;
};

interface WorkflowManagerProps {
  initialSteps?: WorkflowStepItem[];
  moduleName?: string;
  onSave?: (steps: WorkflowStepItem[]) => Promise<void> | void;
}

export function WorkflowManager({
  initialSteps = [
    { id: 1, name: "المدير المباشر", role: "DIRECT_MANAGER" },
    { id: 2, name: "مدير الإدارة / القسم", role: "DEPARTMENT_MANAGER" },
    { id: 3, name: "إدارة الموارد البشرية", role: "HR_MANAGER" }
  ],
  moduleName = "إجازات الموظفين (Leave Requests)",
  onSave
}: WorkflowManagerProps) {
  const [steps, setSteps] = useState<WorkflowStepItem[]>(initialSteps);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  const addStep = () => {
    setSteps((current) => [
      ...current,
      { id: Date.now(), name: "مُعتمِد جديد", role: "CUSTOM_APPROVER", approverIdentifier: "" }
    ]);
  };

  const removeStep = (id: number | string) => {
    setSteps((current) => current.filter((s) => s.id !== id));
  };

  const updateStep = (id: number | string, field: keyof WorkflowStepItem, value: string) => {
    setSteps((current) =>
      current.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const setApprover = (id: number | string, userId: string, label?: string) => {
    setSteps((current) =>
      current.map((s) => (s.id === id ? { ...s, approverIdentifier: userId, approverLabel: label ?? "" } : s))
    );
  };

  const handleSave = () => {
    setMessage("");
    startTransition(async () => {
      try {
        if (onSave) {
          await onSave(steps);
        } else {
          // Default save action to API
          const response = await fetch("/api/enterprise/hierarchy", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ module: moduleName, steps })
          });
          if (!response.ok) throw new Error("فشل حفظ إعدادات مسار الاعتماد");
        }
        setMessage("تم حفظ مسار الطلب وتحديث التسلسل الإداري بنجاح");
      } catch (err: any) {
        setMessage(err.message || "حدث خطأ أثناء حفظ المسار");
      }
    });
  };

  return (
    <Card className="max-w-xl mx-auto rounded-3xl border border-slate-200/80 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden" dir="rtl">
      <CardHeader className="border-b border-slate-100 bg-slate-50/70 pb-5 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center shadow-xs">
              <GitPullRequest className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">إعداد مسار الطلب والتسلسل الإداري</CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5 font-mono">
                {moduleName}
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="bg-white dark:bg-slate-900 text-teal-700 border-teal-200 dark:text-teal-300 font-bold px-2.5 py-1 rounded-xl text-xs">
            {steps.length} مستويات
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-4">
        {message ? (
          <div className={`rounded-2xl p-3.5 text-xs font-semibold flex items-center gap-2 ${
            message.includes("بنجاح")
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
          }`}>
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{message}</span>
          </div>
        ) : null}

        <div className="space-y-3">
          {steps.map((step, index) => (
            <div key={step.id} className="flex flex-col items-center">
              <div className="relative w-full rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 transition-all hover:border-teal-300 hover:bg-white dark:border-slate-800 dark:bg-slate-900/40 dark:hover:border-teal-800 shadow-2xs space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="h-6 w-6 rounded-lg bg-teal-600 text-white text-xs font-black flex items-center justify-center shadow-xs">
                      {index + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">المستوى {index + 1}:</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeStep(step.id)}
                    disabled={steps.length <= 1}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 dark:hover:bg-rose-950/40"
                    title="حذف هذه الخطوة"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1">اسم الخطوة / الوصف</label>
                    <Input
                      value={step.name}
                      onChange={(e) => updateStep(step.id, "name", e.target.value)}
                      placeholder="مثلاً: المشرف المباشر"
                      className="h-9 rounded-xl bg-white dark:bg-slate-900 text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1">الدور المعتمد / الموظف</label>
                    <select
                      value={step.role}
                      onChange={(e) => updateStep(step.id, "role", e.target.value)}
                      className="h-9 w-full rounded-xl border border-input bg-white dark:bg-slate-900 px-3 text-xs font-medium focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="DIRECT_MANAGER">المدير المباشر (Direct Manager)</option>
                      <option value="DEPARTMENT_MANAGER">مدير القسم (Department Manager)</option>
                      <option value="BRANCH_MANAGER">مدير الفرع (Branch Manager)</option>
                      <option value="HOSPITAL_SUPERVISOR">مشرف المستشفى (Hospital Supervisor)</option>
                      <option value="HR_MANAGER">إدارة الموارد البشرية (HR Manager)</option>
                      <option value="SUPER_ADMIN">المدير العام (Super Admin)</option>
                      <option value="CUSTOM_APPROVER">موظف مخصص بالرقم أو الهوية</option>
                    </select>
                  </div>
                </div>

                {step.role === "CUSTOM_APPROVER" && (
                  <div className="pt-1">
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1">الموظف المُعتمِد (Approver)</label>
                    <UserSearchSelect
                      value={step.approverIdentifier ?? ""}
                      initialLabel={step.approverLabel ?? ""}
                      onChange={(userId, label) => setApprover(step.id, userId, label)}
                      placeholder="ابحث عن الموظف بالاسم أو الرقم الوظيفي أو الهوية..."
                    />
                  </div>
                )}
              </div>

              {index < steps.length - 1 && (
                <div className="py-1.5 flex items-center justify-center">
                  <div className="h-6 w-6 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center shadow-2xs">
                    <ArrowDown className="h-4 w-4 animate-bounce" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="pt-2 space-y-3">
          <Button
            type="button"
            onClick={addStep}
            variant="outline"
            className="w-full h-11 rounded-2xl border-2 border-dashed border-teal-500/60 bg-teal-50/20 text-teal-700 hover:border-teal-600 hover:bg-teal-50/50 dark:border-teal-800 dark:bg-teal-950/20 dark:text-teal-300 font-bold gap-2 shadow-2xs"
          >
            <Plus className="h-5 w-5" />
            <span>إضافة خطوة اعتماد جديدة</span>
          </Button>

          <Button
            type="button"
            onClick={handleSave}
            disabled={isPending || steps.length === 0}
            className="w-full h-12 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-teal-600 dark:hover:bg-teal-700 font-black text-sm shadow-lg gap-2"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4 text-teal-400" />}
            <span>حفظ إعدادات مسار الاعتماد</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
