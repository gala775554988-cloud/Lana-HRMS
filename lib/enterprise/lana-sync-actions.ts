import { prisma } from "@/lib/prisma";
import { createEnterpriseNotification } from "@/lib/enterprise/notifications";

export type LanaSyncEntity = "employees" | "documents";

/**
 * Runs an EXISTING sync capability (OdooSyncService.sync() for employees --
 * hourly-cron-backed already, hospitals included via department mapping --
 * or a bulk pass over the existing per-employee syncEmployeeDocuments for
 * documents) on demand, then posts a completion notification with real
 * totals. Deliberately does not duplicate either sync system -- it just
 * triggers what already exists.
 *
 * Must be invoked via Next.js `after()` from the route handler so it keeps
 * running once the immediate "started" chat response has already been sent
 * -- a bare fire-and-forget promise inside a serverless function is not
 * guaranteed to complete after the response returns.
 */
export async function runLanaTriggeredSync(userId: string, entity: LanaSyncEntity): Promise<void> {
  const startedAt = Date.now();
  try {
    if (entity === "employees") {
      const { OdooSyncService } = await import("@/lib/integrations/odoo/sync");
      const service = await OdooSyncService.forConnection();
      const result = await service.sync({ entity: "employees", direction: "ODOO_TO_LANA" });
      const seconds = Math.round((Date.now() - startedAt) / 1000);
      await createEnterpriseNotification({
        userId,
        title: "اكتملت مزامنة بيانات الموظفين",
        body: `تم إنشاء ${result.created} وتحديث ${result.updated} سجل موظف (تخطي ${result.skipped}) خلال ${seconds} ثانية.`,
        type: result.errors.length ? "WARNING" : "SUCCESS"
      });
      return;
    }

    const totals = await runDocumentCrawl();
    const seconds = Math.round((Date.now() - startedAt) / 1000);
    await createEnterpriseNotification({
      userId,
      title: "اكتمل أرشفة المستندات",
      body: `تم سحب ${totals.imported} مستنداً جديداً عبر ${totals.employeesProcessed} موظف (تخطي ${totals.skipped}) خلال ${seconds} ثانية.`,
      type: totals.errors.length ? "WARNING" : "SUCCESS"
    });
  } catch (err) {
    await createEnterpriseNotification({
      userId,
      title: entity === "employees" ? "فشلت مزامنة الموظفين" : "فشلت أرشفة المستندات",
      body: err instanceof Error ? err.message : "خطأ غير معروف",
      type: "ERROR"
    }).catch(() => null);
  }
}

/** Bulk wrapper over the existing per-employee syncEmployeeDocuments --
 * there was no "for every Odoo-linked employee" pass before this. Follows
 * the same ContinueOnError convention as the rest of the sync pipeline. */
async function runDocumentCrawl() {
  const { OdooSyncService } = await import("@/lib/integrations/odoo/sync");
  const { syncEmployeeDocuments } = await import("@/lib/integrations/odoo/documents");
  const service = await OdooSyncService.forConnection();
  await service.client.connect();

  const employees = await prisma.employee.findMany({
    where: { odooId: { not: null } },
    select: { id: true, odooId: true },
    take: 5000
  });

  let imported = 0;
  let skipped = 0;
  let employeesProcessed = 0;
  const errors: Array<{ employeeId: string; message: string }> = [];

  for (const employee of employees) {
    if (typeof employee.odooId !== "number") continue;
    try {
      const result = await syncEmployeeDocuments(service.client, employee.odooId, employee.id);
      imported += result.imported;
      skipped += result.skipped;
      employeesProcessed += 1;
    } catch (err) {
      skipped += 1;
      errors.push({ employeeId: employee.id, message: err instanceof Error ? err.message : String(err) });
      continue; // ContinueOnError -- one employee's failure must never stop the crawl
    }
  }

  return { imported, skipped, employeesProcessed, errors };
}
