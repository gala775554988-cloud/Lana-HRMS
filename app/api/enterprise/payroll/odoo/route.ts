import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canApprovePayroll } from "@/lib/enterprise/payroll-permissions";
import { getPayrollOdooClient } from "@/lib/payroll/connection";
import { pullOdooPayroll, odooPayrollSource, reconcileAccountingOutbox } from "@/lib/payroll/odoo-payroll";
import { accountingMappingSchema, postConfiguredPayrollJournal } from "@/lib/payroll/journal";
import { materializeOdooSnapshot } from "@/lib/payroll/odoo-materialize";
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false }, { status: 401 });
  if (!canApprovePayroll(session)) return NextResponse.json({ success: false }, { status: 403 });
  return NextResponse.json({ success: true, snapshots: await prisma.odooPayrollSnapshot.findMany({ orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, odooPayslipId: true, employeeId: true, period: true, state: true, currency: true, moveId: true, updatedAt: true } }) });
}
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false }, { status: 401 });
  if (!canApprovePayroll(session)) return NextResponse.json({ success: false }, { status: 403 });
  try {
    const body = await request.json();
    if (body.action === "materialize" && typeof body.snapshotId === "string" && typeof body.runId === "string") {
      await materializeOdooSnapshot(body.snapshotId, body.runId, session.user.id);
      return NextResponse.json({ success: true });
    }
    const savedMapping = accountingMappingSchema.safeParse((await prisma.appSetting.findUnique({ where: { key: "payroll.odooAccounting" } }))?.value);
    const { client } = await getPayrollOdooClient(typeof body.connectionId === "string" ? body.connectionId : savedMapping.success ? savedMapping.data.connectionId : undefined); const config = client.getConfig(); const source = odooPayrollSource(config.url, config.database);
    if (body.action === "post-journal" && typeof body.outboxId === "string") {
      const mapping = accountingMappingSchema.parse((await prisma.appSetting.findUnique({ where: { key: "payroll.odooAccounting" } }))?.value);
      if (mapping.mode !== "POST_JOURNAL") throw new Error("Posting is not enabled");
      await postConfiguredPayrollJournal(client, body.outboxId, mapping);
      return NextResponse.json({ success: true });
    }
    const result = body.action === "pull" ? await pullOdooPayroll(client, source) : body.action === "reconcile" && typeof body.outboxId === "string" ? await reconcileAccountingOutbox(client, body.outboxId, source) : null;
    if (!result) throw new Error("Invalid action");
    await prisma.auditLog.create({ data: { actorUserId: session.user.id, action: `payroll:odoo-${body.action}`, entity: "payrollIntegration", metadata: { source } } });
    return NextResponse.json({ success: true, result });
  } catch { return NextResponse.json({ success: false, message: "تعذرت العملية؛ تحقق من إعداد Odoo والمطابقة وقواعد البنود والمسير" }, { status: 400 }); }
}
