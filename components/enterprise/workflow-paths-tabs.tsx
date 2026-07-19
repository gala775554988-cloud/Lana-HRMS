"use client";

import { Building2, Landmark, ShieldCheck } from "lucide-react";
import { WorkflowPathEditor } from "@/components/enterprise/workflow-path-editor";

export function WorkflowPathsTabs() {
  return (
    <div className="space-y-10" dir="rtl">
      {/* 1. المسار الأول: المستشفيات والقطاع الطبي */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 border-b border-teal-200/60 dark:border-teal-900/60 pb-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-teal-50 text-teal-600 shadow-xs dark:bg-teal-950/60 dark:text-teal-400">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">المسار الأول: مسار المستشفيات والقطاع الطبي</h2>
            <p className="text-xs font-semibold text-muted-foreground">عند الضغط على النطاق التشغيلي تظهر جميع المستشفيات؛ ابدأ باختيار المستشفى ثم الموظف المعتمِد واضغط (+) لإضافة المستوى التالي بسلاسة.</p>
          </div>
        </div>
        <WorkflowPathEditor workflowType="HOSPITAL_PATH" defaultName="مسار طلبات المستشفيات والقطاع الطبي" accent="teal" />
      </div>

      {/* 2. المسار الثاني: الإدارة العامة والفروع التشغيلية */}
      <div className="space-y-4 pt-6 border-t-2 border-dashed border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3 border-b border-violet-200/60 dark:border-violet-900/60 pb-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-50 text-violet-600 shadow-xs dark:bg-violet-950/60 dark:text-violet-400">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">المسار الثاني: مسار الإدارة العامة والفروع التشغيلية</h2>
            <p className="text-xs font-semibold text-muted-foreground">التسلسل المعتمد لطلبات الإدارات والفروع؛ اختر الفرع أو الإدارة واختر الموظف المعتمِد واضغط (+) لتوسيع السلسلة.</p>
          </div>
        </div>
        <WorkflowPathEditor workflowType="GENERAL_ADMIN_PATH" defaultName="مسار طلبات الإدارة العامة والفروع" accent="violet" />
      </div>

      {/* Security Assurance Banner */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
        <span>جميع التسلسلات والمسارات المعرفة أعلاه تنطبق تلقائياً على كل طلبات الإجازات والمباشرة والعهد والطلبات المالية فور الضغط على حفظ.</span>
      </div>
    </div>
  );
}
