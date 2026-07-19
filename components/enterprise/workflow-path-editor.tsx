"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { WorkflowManager, type WorkflowStepItem } from "@/components/enterprise/workflow-manager";

type WorkflowPathType = "HOSPITAL_PATH" | "GENERAL_ADMIN_PATH";

type StoredStep = {
  stepOrder: number;
  approverId: string;
  departmentId?: string | null;
  roleContext: string;
  approverLabel?: string;
  approverPosition?: string;
  orgUnitLabel?: string;
};

function toWorkflowSteps(steps: StoredStep[]): WorkflowStepItem[] {
  if (!steps || steps.length === 0) {
    return [{ id: "step-1", approverId: "", orgUnitId: "", roleContext: "" }];
  }
  return steps
    .slice()
    .sort((a, b) => a.stepOrder - b.stepOrder)
    .map((step, index) => {
      const isPlaceholder = step.approverId && (
        step.approverId === "HOSPITAL_INITIATOR" ||
        step.approverId === "HOSPITAL_SUPERVISOR" ||
        step.approverId === "DIRECT_MANAGER" ||
        step.approverId === "HR_MANAGER" ||
        step.approverId === "PAYROLL_OFFICER" ||
        step.approverId === "FINAL_ONBOARDING" ||
        step.approverId === "BRANCH_INITIATOR" ||
        step.approverId === "BRANCH_MANAGER" ||
        step.approverId === "EMPLOYEE_FINAL_STEP" ||
        step.approverId.startsWith("SYSTEM_")
      );
      return {
        id: index + 1,
        approverId: isPlaceholder ? "" : step.approverId,
        approverLabel: isPlaceholder ? "" : (step.approverLabel ?? ""),
        approverPosition: isPlaceholder ? "" : (step.approverPosition ?? ""),
        orgUnitId: step.departmentId ?? "",
        orgUnitLabel: step.orgUnitLabel ?? "",
        roleContext: step.roleContext ?? ""
      };
    });
}

function toStoredSteps(steps: WorkflowStepItem[]): StoredStep[] {
  return steps.map((step, index) => ({
    stepOrder: index + 1,
    approverId: step.approverId,
    departmentId: step.orgUnitId || null,
    roleContext: step.roleContext || "",
    approverLabel: step.approverLabel || "",
    approverPosition: step.approverPosition || "",
    orgUnitLabel: step.orgUnitLabel || ""
  }));
}

export function WorkflowPathEditor({ workflowType, defaultName, accent = "teal" }: { workflowType: WorkflowPathType; defaultName: string; accent?: "teal" | "violet" }) {
  const [loading, setLoading] = useState(true);
  const [initialSteps, setInitialSteps] = useState<WorkflowStepItem[] | null>(null);
  const [initialSendToDirectManager, setInitialSendToDirectManager] = useState<boolean>(true);
  const [initialName, setInitialName] = useState<string>(defaultName);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/enterprise/workflow-paths?workflowType=${workflowType}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success && data.path) {
          setInitialSteps(toWorkflowSteps(data.path.steps));
          if (typeof data.path.sendToDirectManagerFirst === "boolean") {
            setInitialSendToDirectManager(data.path.sendToDirectManagerFirst);
          }
          if (data.path.workflowName) {
            setInitialName(data.path.workflowName);
          }
        } else {
          setInitialSteps([]);
        }
      })
      .catch(() => { if (!cancelled) setError("تعذر تحميل المسار الحالي."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [workflowType]);

  async function handleSave(steps: WorkflowStepItem[], sendToDirectManagerFirst = true, customName = "") {
    const response = await fetch("/api/enterprise/workflow-paths", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workflowType,
        workflowName: customName || initialName || defaultName,
        sendToDirectManagerFirst,
        steps: toStoredSteps(steps)
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      throw new Error(data.message || "فشل حفظ المسار");
    }
  }

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>;
  }

  return (
    <WorkflowManager
      key={workflowType}
      moduleName={initialName || defaultName}
      accent={accent}
      initialSteps={initialSteps ?? []}
      initialSendToDirectManagerFirst={initialSendToDirectManager}
      defaultOrgScopeType={workflowType === "HOSPITAL_PATH" ? "hospital" : "branch"}
      onSave={handleSave}
    />
  );
}
