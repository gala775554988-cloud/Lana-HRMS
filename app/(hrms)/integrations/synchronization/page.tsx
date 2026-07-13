import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { IntegrationShell, DataCard, SimpleTable } from "@/components/integrations/integration-shell";
import { OdooEmployeeMasterSyncButton } from "@/components/integrations/OdooEmployeeMasterSyncButton";
import { BioTimeAttendanceSyncButton } from "@/components/integrations/BioTimeAttendanceSyncButton";
import { enqueueSync, syncMapping } from "@/lib/integrations/service";
import Link from "next/link";

async function runSync(formData: FormData) { 
  "use server"; 
  await syncMapping(String(formData.get("connectionId")), String(formData.get("mappingId")), String(formData.get("direction")) as "HRMS_TO_ODOO" | "ODOO_TO_HRMS" | "BIDIRECTIONAL"); 
}

async function queueSync(formData: FormData) { 
  "use server"; 
  await enqueueSync({ 
    connectionId: String(formData.get("connectionId")), 
    mappingId: String(formData.get("mappingId")), 
    direction: String(formData.get("direction")) as "HRMS_TO_ODOO" | "ODOO_TO_HRMS" | "BIDIRECTIONAL" 
  }); 
}

export default async function SynchronizationPage() {
  const [connections, mappings, history, conflicts, logs, employeesCount, departmentsCount, branchesCount, contractsCount] = await Promise.all([
    prisma.integrationConnection.findMany().catch(() => []),
    prisma.integrationMapping.findMany({ where: { isActive: true } }).catch(() => []),
    prisma.syncHistory.findMany({ take: 30, orderBy: { startedAt: "desc" } }).catch(() => []),
    prisma.conflictLog.findMany({ where: { resolution: "PENDING" }, take: 30, orderBy: { createdAt: "desc" } }).catch(() => []),
    prisma.integrationLog.findMany({ take: 50, orderBy: { createdAt: "desc" } }).catch(() => []),
    prisma.employee.count().catch(() => 0),
    prisma.department.count().catch(() => 0),
    prisma.branch.count().catch(() => 0),
    prisma.employeeContract.count().catch(() => 0),
  ]);

  const lastSync = history[0];
  const connectionStatus = connections[0]?.status || "DISCONNECTED";
  const lastErrors = history.filter(h => h.status === "FAILED" || h.error).slice(0, 5);

  const form = (action: (formData: FormData) => Promise<void>, label: string) => (
    <form action={action} className="grid gap-3 md:grid-cols-4">
      <select name="connectionId" className="h-10 rounded-md border bg-background px-3">
        {connections.map((c: any) => <option key={c.id} value={c.id}>{c.name} - {c.status}</option>)}
      </select>
      <select name="mappingId" className="h-10 rounded-md border bg-background px-3">
        {mappings.map((m: any) => <option key={m.id} value={m.id}>{m.hrmsModule} ↔ {m.externalModel}</option>)}
      </select>
      <select name="direction" className="h-10 rounded-md border bg-background px-3">
        <option value="BIDIRECTIONAL">Both Directions</option>
        <option value="HRMS_TO_ODOO">HRMS → Odoo</option>
        <option value="ODOO_TO_HRMS">Odoo → HRMS</option>
      </select>
      <Button type="submit">{label}</Button>
    </form>
  );

  return (
    <IntegrationShell title="مزامنة Odoo 🔄" description="صفحة كاملة تحتوي حالة الاتصال، آخر مزامنة، عدد الموظفين، الإدارات، الفروع، العقود، الأخطاء، إعادة المزامنة، جدولة المزامنة، Logs - متوافقة بالكامل مع Odoo">
      
      <OdooEmployeeMasterSyncButton />
      <BioTimeAttendanceSyncButton />

      {/* Connection Status & Last Sync */}
      <div className="grid gap-4 md:grid-cols-3">
        <DataCard title="حالة الاتصال">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${connectionStatus === "CONNECTED" ? "bg-green-500" : "bg-red-500"}`} />
              <span className="font-bold">{connectionStatus}</span>
            </div>
            <div className="text-sm text-muted-foreground">الاتصالات: {connections.length}</div>
            <div className="text-xs">Base URL: {(connections[0] as any)?.baseUrl || "-"}</div>
            <div className="text-xs">Last Test: {(connections[0] as any)?.lastTestAt ? new Date((connections[0] as any).lastTestAt).toLocaleString("ar-SA") : "-"}</div>
          </div>
        </DataCard>

        <DataCard title="آخر مزامنة">
          <div className="space-y-2">
            <div className="text-sm">الكيان: {lastSync?.entity || "-"}</div>
            <div className="text-sm">الحالة: <span className={`px-2 py-1 rounded-full text-xs ${lastSync?.status === "COMPLETED" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{lastSync?.status || "-"}</span></div>
            <div className="text-xs">بدأت: {lastSync?.startedAt ? new Date(lastSync.startedAt).toLocaleString("ar-SA") : "-"}</div>
            <div className="text-xs">انتهت: {lastSync?.finishedAt ? new Date(lastSync.finishedAt).toLocaleString("ar-SA") : "-"}</div>
            <div className="text-xs">Pulled: {lastSync?.pulled || 0} | Pushed: {lastSync?.pushed || 0}</div>
          </div>
        </DataCard>

        <DataCard title="عدد السجلات">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>الموظفون: <strong>{employeesCount}</strong></div>
            <div>الإدارات: <strong>{departmentsCount}</strong></div>
            <div>الفروع: <strong>{branchesCount}</strong></div>
            <div>العقود: <strong>{contractsCount}</strong></div>
            <div>المزامنات: <strong>{history.length}</strong></div>
            <div>التعارضات: <strong>{conflicts.length}</strong></div>
          </div>
        </DataCard>
      </div>

      <DataCard title="إعادة المزامنة وجدولة المزامنة">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Link href="/api/integrations/odoo/sync/report" target="_blank"><Button variant="outline">تقرير المزامنة JSON</Button></Link>
            <Link href="/integrations/duplicate-national-ids"><Button variant="outline">تقرير الهوية المكررة</Button></Link>
            <Link href="/employees?tab=archived"><Button variant="outline">الموظفون المؤرشفون ({history.filter((h:any)=>h.entity==="employees").length})</Button></Link>
          </div>
          <div className="text-sm text-muted-foreground">
            <p>• <strong>إعادة المزامنة:</strong> استخدم زر Run Now أدناه مع اتجاه ODOO_TO_HRMS و Batch 500</p>
            <p>• <strong>جدولة المزامنة:</strong> يتم عبر Queue Background Sync - يعمل كل 10 دقائق + يومياً 2AM عبر Cron</p>
            <p>• <strong>Logs:</strong> تظهر أدناه مع الأخطاء والتفاصيل</p>
          </div>
        </div>
      </DataCard>

      <DataCard title="الأخطاء">
        <div className="space-y-2">
          {lastErrors.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا يوجد أخطاء حديثة - المزامنة تعمل بشكل جيد ✅</p>
          ) : (
            lastErrors.map((err: any) => (
              <div key={err.id} className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
                <p className="font-bold text-red-800">{err.entity} - {err.status} - {err.error?.slice(0,200) || "No error message"}</p>
                <p className="text-xs text-muted-foreground mt-1">{err.startedAt ? new Date(err.startedAt).toLocaleString("ar-SA") : ""} - Pulled: {err.pulled}, Created: {err.createdCount}, Skipped: {(err.metadata as any)?.skipped || 0}</p>
              </div>
            ))
          )}
        </div>
      </DataCard>

      <DataCard title="أدوات إضافية">
        <div className="flex flex-wrap gap-2">
          <a href="/integrations/duplicate-national-ids"><Button>تقرير أرقام الهوية المكررة</Button></a>
          <a href="/api/integrations/odoo/duplicate-national-ids" target="_blank"><Button variant="outline">API مباشر (JSON)</Button></a>
          <a href="/employees?tab=duplicates"><Button variant="outline">الحسابات المكررة</Button></a>
          <a href="/employees?tab=archived"><Button variant="outline">المؤرشفون</Button></a>
        </div>
        <div className="mt-2 text-sm text-muted-foreground">يعرض جميع أرقام الهوية المكررة في Odoo مع إمكانية البحث والتصدير Excel/PDF</div>
      </DataCard>

      <DataCard title="Run Sync Now (إعادة المزامنة)">{form(runSync, "Run Now - مزامنة فورية")}</DataCard>
      <DataCard title="Queue Background Sync (جدولة)">{form(queueSync, "Queue Job - جدولة في الخلفية")}</DataCard>
      
      <DataCard title="Sync History (آخر 30 مزامنة)"><SimpleTable columns={["startedAt", "finishedAt", "entity", "direction", "status", "pulled", "pushed", "createdCount", "conflictCount", "error"]} rows={history as unknown as Array<Record<string, unknown>>} /></DataCard>
      
      <DataCard title="Logs (آخر 50 سجل)">
        <div className="overflow-x-auto rounded-md border max-h-96">
          <table className="w-full text-xs">
            <thead className="bg-muted/60 sticky top-0"><tr><th className="px-3 py-2 text-right">الوقت</th><th className="px-3 py-2">المستوى</th><th className="px-3 py-2">الإجراء</th><th className="px-3 py-2">الرسالة</th></tr></thead>
            <tbody className="divide-y">
              {logs.map((log: any) => (
                <tr key={log.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2">{new Date(log.createdAt).toLocaleString("ar-SA")}</td>
                  <td className="px-3 py-2"><span className={`px-2 py-1 rounded-full text-[10px] ${log.level === "ERROR" ? "bg-red-100 text-red-800" : log.level === "WARN" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>{log.level}</span></td>
                  <td className="px-3 py-2 font-mono text-[11px]">{log.action}</td>
                  <td className="px-3 py-2 max-w-md truncate">{log.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataCard>

      <DataCard title="Pending Conflicts"><SimpleTable columns={["createdAt", "entity", "localId", "externalId", "field", "resolution"]} rows={conflicts as unknown as Array<Record<string, unknown>>} /></DataCard>
    </IntegrationShell>
  );
}
