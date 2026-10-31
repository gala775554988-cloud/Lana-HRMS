import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getModuleRecord } from "@/lib/hrms/actions";
import { hasPermission } from "@/lib/rbac";
import { OdooSyncService } from "@/lib/integrations/odoo/sync";
import { syncEmployeeManager } from "@/lib/integrations/odoo/manager-sync";
import { writeAuditLog } from "@/lib/audit";

export const maxDuration = 60;
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false }, { status: 401 });
  if (!hasPermission(session.user.permissions, { action: "edit", resource: "employees" }, session.user.roles)) return NextResponse.json({ success: false }, { status: 403 });
  try {
    const { id } = await params;
    // Reuse the employee visibility/scope check before accessing the source.
    const record = await getModuleRecord("employees", id);
    if (!record) return NextResponse.json({ success: false }, { status: 404 });
    if (!record.odooId) return NextResponse.json({ success: true, changed: false });
    const service = await OdooSyncService.forConnection();
    const result = await syncEmployeeManager(service.client, id);
    if (result.changed) await writeAuditLog({ actorUserId: session.user.id, action: "employee:manager_synced", entity: "employee", entityId: id });
    return NextResponse.json({ success: true, changed: result.changed });
  } catch { return NextResponse.json({ success: false, message: "تعذر تحديث المدير من أودو. أعد المحاولة." }, { status: 502 }); }
}
