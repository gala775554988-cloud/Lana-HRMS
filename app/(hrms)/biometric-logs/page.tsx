import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BiometricLogsRefresher } from "@/components/hrms/biometric-logs-refresher";

type ParsedNote = { source?: string; deviceName?: string; deviceIp?: string; receivedAt?: string };

function parseNotes(notes: string | null): ParsedNote {
  if (!notes) return {};
  try {
    return JSON.parse(notes) as ParsedNote;
  } catch {
    return {};
  }
}

async function getBiometricLogs() {
  const records = await prisma.attendanceRecord.findMany({
    where: { notes: { not: null } },
    include: { employee: { select: { employeeNumber: true, firstName: true, lastName: true } } },
    orderBy: { updatedAt: "desc" },
    take: 50
  });

  return records
    .map((record) => ({ record, parsed: parseNotes(record.notes) }))
    .filter(({ parsed }) => parsed.source);
}

export default async function BiometricLogsPage() {
  const logs = await getBiometricLogs();

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between rounded-2xl border bg-background p-6 shadow-sm">
        <div>
          <p className="text-sm font-medium text-muted-foreground">الحضور والبصمة</p>
          <h1 className="text-3xl font-semibold tracking-tight">سجلات البصمة المباشرة</h1>
          <p className="mt-2 text-muted-foreground">آخر 50 عملية بصمة واردة من أجهزة الحضور (ZKTeco / BioTime).</p>
        </div>
        <BiometricLogsRefresher />
      </div>

      <Card>
        <CardHeader><CardTitle>السجلات الأخيرة</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-right text-xs text-muted-foreground">
                  <th className="p-2">الموظف</th>
                  <th className="p-2">الجهاز</th>
                  <th className="p-2">المصدر</th>
                  <th className="p-2">دخول</th>
                  <th className="p-2">خروج</th>
                  <th className="p-2">آخر تحديث</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(({ record, parsed }) => (
                  <tr key={record.id} className="border-b last:border-0">
                    <td className="p-2 font-medium">{record.employee.firstName} {record.employee.lastName} ({record.employee.employeeNumber})</td>
                    <td className="p-2 text-muted-foreground">{parsed.deviceName ?? "—"} {parsed.deviceIp ? `(${parsed.deviceIp})` : ""}</td>
                    <td className="p-2"><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{parsed.source}</span></td>
                    <td className="p-2 text-muted-foreground">{record.checkIn ? new Date(record.checkIn).toLocaleTimeString("ar-SA") : "—"}</td>
                    <td className="p-2 text-muted-foreground">{record.checkOut ? new Date(record.checkOut).toLocaleTimeString("ar-SA") : "—"}</td>
                    <td className="p-2 text-muted-foreground">{new Date(record.updatedAt).toLocaleString("ar-SA")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!logs.length && <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">لا توجد سجلات بصمة بعد.</div>}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
