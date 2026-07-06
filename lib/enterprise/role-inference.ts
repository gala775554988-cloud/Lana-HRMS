export function inferEnterpriseRolesFromPosition(title: string | null | undefined): string[] {
  const value = String(title ?? "").trim().toLowerCase();
  const roles = new Set<string>();
  if (!value) return [];
  if (value.includes("مشرف") || value.includes("supervisor")) roles.add("SUPERVISOR");
  if (value.includes("مدير فرع") || value.includes("branch manager")) roles.add("BRANCH_MANAGER");
  if (value.includes("مدير إدارة") || value.includes("department manager")) roles.add("DEPARTMENT_MANAGER");
  if (value.includes("مدير مشاريع") || value.includes("project manager")) roles.add("PROJECT_MANAGER");
  if (value.includes("مدير الموارد البشرية") || value.includes("hr manager")) roles.add("HR_MANAGER");
  if (value.includes("مسؤول الرواتب") || value.includes("payroll")) roles.add("PAYROLL_MANAGER");
  if (value.includes("مسؤول التأمين") || value.includes("insurance")) roles.add("INSURANCE_OFFICER");
  if (value.includes("مسؤول الإقامة") || value.includes("residency")) roles.add("RESIDENCY_OFFICER");
  if (value.includes("مسؤول الطلبات") || value.includes("requests")) roles.add("REQUESTS_OFFICER");
  if (value.includes("مسؤول المستلزمات") || value.includes("warehouse")) roles.add("WAREHOUSE_OFFICER");
  if (value.includes("مسؤول الأصول") || value.includes("assets")) roles.add("ASSETS_OFFICER");
  if (value.includes("مسؤول التدريب") || value.includes("training")) roles.add("TRAINING_OFFICER");
  if (value.includes("مسؤول الأداء") || value.includes("performance")) roles.add("PERFORMANCE_OFFICER");
  return Array.from(roles);
}
