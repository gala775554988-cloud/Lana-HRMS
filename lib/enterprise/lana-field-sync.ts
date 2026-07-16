import { prisma } from "@/lib/prisma";
import { createEnterpriseNotification } from "@/lib/enterprise/notifications";

export type FieldSyncMode = "identity" | "full";

type EmployeeSnapshot = {
  employeeNumber: string;
  nationalId: string;
  hospitalName: string | null;
  analyticAccount: string | null;
  salaryAmount: number | null;
};

async function snapshotEmployee(employeeId: string): Promise<EmployeeSnapshot | null> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      employeeNumber: true,
      nationalId: true,
      analyticAccount: true,
      hospital: { select: { name: true } },
      contracts: { select: { salaryAmount: true }, orderBy: { startDate: "desc" }, take: 1 }
    }
  });
  if (!employee) return null;
  return {
    employeeNumber: employee.employeeNumber,
    nationalId: employee.nationalId,
    hospitalName: employee.hospital?.name ?? null,
    analyticAccount: employee.analyticAccount ?? null,
    salaryAmount: employee.contracts[0]?.salaryAmount !== undefined && employee.contracts[0]?.salaryAmount !== null ? Number(employee.contracts[0].salaryAmount) : null
  };
}

function diffSnapshots(before: EmployeeSnapshot, after: EmployeeSnapshot, ar: boolean): string[] {
  const changes: string[] = [];
  const labels: Record<keyof EmployeeSnapshot, string> = {
    employeeNumber: ar ? "الكود" : "code",
    nationalId: ar ? "رقم الهوية" : "national ID",
    hospitalName: ar ? "المستشفى" : "hospital",
    analyticAccount: ar ? "الحساب التحليلي" : "analytic account",
    salaryAmount: ar ? "الراتب" : "salary"
  };
  for (const key of Object.keys(labels) as Array<keyof EmployeeSnapshot>) {
    if (before[key] !== after[key]) {
      changes.push(ar
        ? `تم تحديث ${labels[key]} من "${before[key] ?? "-"}" إلى "${after[key] ?? "-"}"`
        : `${labels[key]} updated from "${before[key] ?? "-"}" to "${after[key] ?? "-"}"`);
    }
  }
  return changes;
}

export type FieldSyncResult =
  | { success: true; employeeId: string; label: string; changes: string[] }
  | { success: false; employeeId: string; label: string; reason: string };

/**
 * Refreshes ONE employee from Odoo and reports exactly what changed.
 * "identity" mode reuses the existing narrow syncEmployeeIdentitiesOnly
 * (employeeNumber + nationalId only, with its strict validation). "full"
 * mode reuses the existing syncSingleEmployeeDetails (hospital via the
 * confirmed "school" Odoo field, analytic account via the confirmed
 * "analytic_account" field, salary via the linked contract's wage) -- both
 * are already-established, confirmed field mappings; nothing here invents
 * a new one.
 */
export async function syncEmployeeFieldsFromOdoo(employeeId: string, mode: FieldSyncMode, ar: boolean): Promise<FieldSyncResult> {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, odooId: true, firstName: true, lastName: true, employeeNumber: true } });
  const label = employee ? `${employee.firstName} ${employee.lastName} (${employee.employeeNumber})` : employeeId;
  if (!employee) return { success: false, employeeId, label: employeeId, reason: ar ? "الموظف غير موجود محلياً" : "Employee not found locally" };
  if (typeof employee.odooId !== "number" || employee.odooId <= 0) {
    return { success: false, employeeId, label, reason: ar ? "غير مرتبط بأودو (لا يوجد odooId)" : "Not linked to Odoo (no odooId)" };
  }

  const before = await snapshotEmployee(employeeId);
  if (!before) return { success: false, employeeId, label, reason: ar ? "تعذر قراءة السجل المحلي" : "Could not read local record" };

  try {
    const { OdooSyncService } = await import("@/lib/integrations/odoo/sync");
    const service = await OdooSyncService.forConnection();
    await service.client.connect();

    if (mode === "identity") {
      const { syncEmployeeIdentitiesOnly } = await import("@/lib/integrations/odoo/identity-sync");
      const [row] = await service.client.search_read("hr.employee", [["id", "=", employee.odooId]], ["id", "barcode", "identification_id"], {} as any);
      if (!row) return { success: false, employeeId, label, reason: ar ? "لم يتم العثور على السجل في أودو" : "Record not found in Odoo" };
      const outcome = await syncEmployeeIdentitiesOnly([row as any]);
      if (outcome.updated === 0 && outcome.skipped > 0) {
        const reason = outcome.errors[0]?.reason ?? "unknown";
        return { success: false, employeeId, label, reason: ar ? `تعذر التحديث: ${reason}` : `Could not update: ${reason}` };
      }
    } else {
      await service.syncSingleEmployeeDetails(employee.odooId, employeeId);
    }

    const after = await snapshotEmployee(employeeId);
    if (!after) return { success: false, employeeId, label, reason: ar ? "تعذر قراءة السجل بعد التحديث" : "Could not read record after update" };
    const changes = diffSnapshots(before, after, ar);
    return { success: true, employeeId, label, changes };
  } catch (err) {
    return { success: false, employeeId, label, reason: err instanceof Error ? err.message : String(err) };
  }
}

function formatReport(results: FieldSyncResult[], ar: boolean): string {
  const succeeded = results.filter((r): r is Extract<FieldSyncResult, { success: true }> => r.success);
  const failed = results.filter((r): r is Extract<FieldSyncResult, { success: false }> => !r.success);

  const lines: string[] = [];
  lines.push(ar ? "العملية: تحديث بيانات من أودو" : "Operation: update data from Odoo");
  lines.push(ar ? `النتيجة: تم التحديث بنجاح لـ ${succeeded.length} / فشل التحديث لـ ${failed.length}` : `Result: ${succeeded.length} updated successfully / ${failed.length} failed`);
  if (succeeded.length) {
    lines.push(ar ? "\nالتفاصيل:" : "\nDetails:");
    for (const r of succeeded) {
      lines.push(r.changes.length ? `- ${r.label}: ${r.changes.join("، ")}` : `- ${r.label}: ${ar ? "لا يوجد تغيير (البيانات مطابقة بالفعل)" : "no change (already matched)"}`);
    }
  }
  if (failed.length) {
    lines.push(ar ? "\nالمتعثرون (يحتاجون مراجعة يدوية):" : "\nStragglers (need manual review):");
    for (const r of failed) lines.push(`- ${r.label}: ${r.reason}`);
  }
  return lines.join("\n");
}

/** Runs the same per-employee refresh across a group (e.g. every employee
 * currently at a given hospital), ContinueOnError, then posts the full
 * table-style report as a notification once done -- called via after() so
 * it keeps running past the immediate chat acknowledgment. */
export async function runGroupFieldSync(userId: string, employeeIds: string[], mode: FieldSyncMode, groupLabel: string, ar: boolean): Promise<void> {
  const results: FieldSyncResult[] = [];
  for (const employeeId of employeeIds) {
    try {
      results.push(await syncEmployeeFieldsFromOdoo(employeeId, mode, ar));
    } catch (err) {
      results.push({ success: false, employeeId, label: employeeId, reason: err instanceof Error ? err.message : String(err) });
      continue; // ContinueOnError -- one employee's failure must never stop the batch
    }
  }
  const report = formatReport(results, ar);
  const failedCount = results.filter((r) => !r.success).length;
  await createEnterpriseNotification({
    userId,
    title: ar ? `تقرير مزامنة: ${groupLabel}` : `Sync report: ${groupLabel}`,
    body: report,
    type: failedCount === 0 ? "SUCCESS" : failedCount === results.length ? "ERROR" : "WARNING"
  });
}

export { formatReport as formatFieldSyncReport };
