"use client";

import { useState } from "react";
import { Building2, Landmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { WorkflowPathEditor } from "@/components/enterprise/workflow-path-editor";

const TABS = [
  {
    value: "HOSPITAL_PATH" as const,
    label: "المسار الأول: المستشفيات",
    icon: Building2,
    defaultName: "مسار طلبات المستشفيات",
    accent: "teal" as const,
    active: "border-teal-500 bg-teal-50 text-teal-700 dark:border-teal-600 dark:bg-teal-950/40 dark:text-teal-300",
    inactive: "border-transparent text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
  },
  {
    value: "GENERAL_ADMIN_PATH" as const,
    label: "المسار الثاني: بقية الإدارات",
    icon: Landmark,
    defaultName: "المسار الإداري العام",
    accent: "violet" as const,
    active: "border-violet-500 bg-violet-50 text-violet-700 dark:border-violet-600 dark:bg-violet-950/40 dark:text-violet-300",
    inactive: "border-transparent text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
  }
];

export function WorkflowPathsTabs() {
  const [active, setActive] = useState<(typeof TABS)[number]["value"]>("HOSPITAL_PATH");
  const activeTab = TABS.find((tab) => tab.value === active)!;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-0 dark:border-slate-800">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.value === active;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActive(tab.value)}
              className={cn(
                "flex items-center gap-2 rounded-t-2xl border-b-2 px-4 py-2.5 text-sm font-bold transition",
                isActive ? tab.active : tab.inactive
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <WorkflowPathEditor key={activeTab.value} workflowType={activeTab.value} defaultName={activeTab.defaultName} accent={activeTab.accent} />
    </div>
  );
}
