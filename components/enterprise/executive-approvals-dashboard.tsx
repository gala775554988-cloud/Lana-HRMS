"use client";

import React, { useState, useEffect, useTransition } from "react";
import { Check, X, Clock3, AlertCircle, CheckCircle2, ShieldCheck, Building2, User, GitPullRequest, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type WorkflowRequestItem = {
  id: string;
  type: string;
  status: string;
  createdAt: string;
  entityId: string;
  employeeId: string;
  currentStep: number;
  requesterName?: string;
  departmentName?: string;
  hospitalName?: string;
  details?: string;
  activeStepRole?: string;
};

export function ExecutiveApprovalsDashboard() {
  const [requests, setRequests] = useState<WorkflowRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  const fetchPendingRequests = () => {
    setIsLoading(true);
    fetch("/api/enterprise/requests?status=PENDING&limit=50")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.requests)) {
          setRequests(data.requests);
        } else {
          setRequests([]);
        }
      })
      .catch(() => setRequests([]))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchPendingRequests();
  }, []);

  const handleDecision = (workflowId: string, decision: "APPROVE" | "REJECT", reqTitle: string) => {
    setMessage("");
    startTransition(async () => {
      try {
        const res = await fetch(`/api/enterprise/workflows/${workflowId}/decision`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision, comments: `Executive decision (${decision}) via Dashboard` })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          throw new Error(data.message || "تعذر إتمام الإجراء على الخادم");
        }

        setRequests((current) => current.filter((r) => r.id !== workflowId));
        setMessage(decision === "APPROVE" ? `تم اعتماد طلب (${reqTitle}) وتمريره في التسلسل بنجاح` : `تم رفض طلب (${reqTitle}) بنجاح`);
      } catch (err: any) {
        setMessage(err.message || "حدث خطأ أثناء معالجة الطلب");
      }
    });
  };

  const hospitalRequestsCount = requests.filter((r) => r.hospitalName || r.activeStepRole?.includes("HOSPITAL")).length;
  const leaveRequestsCount = requests.filter((r) => r.type === "LEAVE" || r.type === "إجازة").length;

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto" dir="rtl">
      {/* Page Title & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-primary/8 dark:bg-primary/60 text-primary dark:text-primary/50 flex items-center justify-center shadow-xs shrink-0">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">لوحة القيادة التنفيذية والموافقات</h1>
              <Badge className="bg-teal-500/20 text-teal-700 border-teal-200 dark:text-teal-300 font-mono text-xs">
                Neon RLS Protected
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              مراجعة واعتماد الطلبات المعلقة المتصلة بمحرك التوجيه الذاتي (Auto-Pipeline Engine)
            </p>
          </div>
        </div>

        <Button
          type="button"
          onClick={fetchPendingRequests}
          disabled={isLoading || isPending}
          variant="outline"
          className="rounded-xl gap-2 h-10 px-4 self-end sm:self-auto font-bold"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          <span>تحديث القائمة</span>
        </Button>
      </div>

      {/* Message Banner */}
      {message ? (
        <div className={`rounded-2xl p-4 text-xs font-semibold flex items-center gap-2.5 shadow-sm animate-in fade-in duration-200 ${
          message.includes("بنجاح")
            ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
            : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
        }`}>
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{message}</span>
        </div>
      ) : null}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="rounded-3xl border border-slate-200/80 bg-white shadow-md dark:border-slate-800 dark:bg-slate-900 overflow-hidden relative group">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              <span>إجمالي الطلبات المعلقة</span>
              <Clock3 className="h-4 w-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-slate-900 dark:text-slate-100 font-mono">
              {isLoading ? "-" : requests.length}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">بانتظار القرار أو التمرير للمستوى التالي</p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-slate-200/80 bg-white shadow-md dark:border-slate-800 dark:bg-slate-900 overflow-hidden relative group">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              <span>طلبات المستشفيات والأفرع الطبية</span>
              <Building2 className="h-4 w-4 text-teal-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-teal-600 dark:text-teal-400 font-mono">
              {isLoading ? "-" : hospitalRequestsCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">موجّهة لمشرفي المواقع الطبية (HOSPITAL_SUPERVISOR)</p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-slate-200/80 bg-white shadow-md dark:border-slate-800 dark:bg-slate-900 overflow-hidden relative group">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              <span>طلبات الإجازات والعمل الإضافي</span>
              <GitPullRequest className="h-4 w-4 text-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-amber-600 dark:text-amber-400 font-mono">
              {isLoading ? "-" : leaveRequestsCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">تتطلب مراجعة الأرصدة والموافقات السريعة</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Requests Table / List Container */}
      <Card className="rounded-3xl border border-slate-200/80 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        <CardHeader className="border-b border-slate-100 bg-slate-50/60 pb-4 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
              قائمة الطلبات الجديدة والمعلقة
            </CardTitle>
            <Badge variant="secondary" className="font-bold px-2.5 py-0.5 rounded-lg text-xs">
              {requests.length} طلب
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-xs font-bold">جاري سحب الطلبات المعلقة مباشرة من قاعدة بيانات Neon...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground space-y-2 text-center">
              <div className="h-12 w-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shadow-2xs">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <p className="font-bold text-sm text-slate-800 dark:text-slate-200">لا توجد طلبات معلقة بانتظار قرارك حالياً</p>
              <p className="text-xs max-w-sm">تم إنجاز وتمرير كافة الطلبات في التسلسل الإداري بنجاح 100%.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {requests.map((req) => {
                const title = `${req.requesterName || "موظف"} - ${req.type}`;
                return (
                  <div
                    key={req.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-900/60"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="bg-primary text-white text-[10px] font-mono px-2 py-0">
                          {req.type}
                        </Badge>
                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                          {req.requesterName || "موظف غير محدد"}
                        </span>
                        {req.hospitalName ? (
                          <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 text-[10px]">
                            {req.hospitalName}
                          </Badge>
                        ) : req.departmentName ? (
                          <Badge variant="outline" className="text-[10px]">{req.departmentName}</Badge>
                        ) : null}
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed truncate">
                        {req.details || `تقديم طلب ${req.type} بانتظار الاعتماد الرأسي`}
                      </p>

                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-0.5">
                        <span>المستوى {req.currentStep || 1}: {req.activeStepRole || "المشرف المباشر"}</span>
                        <span>•</span>
                        <span>{new Date(req.createdAt).toLocaleDateString("ar-SA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      <Button
                        type="button"
                        onClick={() => handleDecision(req.id, "APPROVE", title)}
                        disabled={isPending}
                        className="h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 gap-1.5 shadow-sm"
                      >
                        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        <span>اعتماد</span>
                      </Button>

                      <Button
                        type="button"
                        onClick={() => handleDecision(req.id, "REJECT", title)}
                        disabled={isPending}
                        variant="outline"
                        className="h-9 rounded-xl text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold text-xs px-4 gap-1.5"
                      >
                        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                        <span>رفض</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
