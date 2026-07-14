import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

async function getBranchStats() {
  const branches = await prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true, code: true } });
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0));

  const stats = await Promise.all(
    branches.map(async (branch) => {
      const [headcount, pendingLeave, attendanceToday] = await Promise.all([
        prisma.employee.count({ where: { branchId: branch.id, status: "ACTIVE" } }),
        prisma.leaveRequest.count({ where: { status: "PENDING", employee: { branchId: branch.id } } }),
        prisma.attendanceRecord.count({ where: { workDate: { gte: todayStart }, employee: { branchId: branch.id } } })
      ]);
      return { ...branch, headcount, pendingLeave, attendanceToday };
    })
  );

  return stats.sort((a, b) => b.headcount - a.headcount);
}

async function getHospitalStats() {
  const hospitals = await prisma.hospital.findMany({ where: { isActive: true }, select: { id: true, name: true, code: true } });
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0));

  const stats = await Promise.all(
    hospitals.map(async (hospital) => {
      const [headcount, pendingLeave, attendanceToday] = await Promise.all([
        prisma.employee.count({ where: { hospitalId: hospital.id, status: "ACTIVE" } }),
        prisma.leaveRequest.count({ where: { status: "PENDING", employee: { hospitalId: hospital.id } } }),
        prisma.attendanceRecord.count({ where: { workDate: { gte: todayStart }, employee: { hospitalId: hospital.id } } })
      ]);
      return { ...hospital, headcount, pendingLeave, attendanceToday };
    })
  );

  return stats.sort((a, b) => b.headcount - a.headcount);
}

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{value}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default async function BranchAnalyticsPage() {
  const [branchStats, hospitalStats] = await Promise.all([getBranchStats(), getHospitalStats()]);
  const maxBranchHeadcount = Math.max(1, ...branchStats.map((b) => b.headcount));
  const maxHospitalHeadcount = Math.max(1, ...hospitalStats.map((h) => h.headcount));

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border bg-background p-6 shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">التحليلات</p>
        <h1 className="text-3xl font-semibold tracking-tight">تحليلات الفروع والمستشفيات</h1>
        <p className="mt-2 text-muted-foreground">توزيع الموظفين، الإجازات المعلقة، وحضور اليوم حسب الفرع والمستشفى.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>حسب الفرع</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {branchStats.map((branch) => (
              <div key={branch.id} className="space-y-2 rounded-xl border p-3">
                <BarRow label={`${branch.name} (${branch.code})`} value={branch.headcount} max={maxBranchHeadcount} />
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>حضور اليوم: {branch.attendanceToday}</span>
                  <span>إجازات معلقة: {branch.pendingLeave}</span>
                </div>
              </div>
            ))}
            {!branchStats.length && <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">لا توجد فروع نشطة.</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>حسب المستشفى</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {hospitalStats.map((hospital) => (
              <div key={hospital.id} className="space-y-2 rounded-xl border p-3">
                <BarRow label={`${hospital.name} (${hospital.code})`} value={hospital.headcount} max={maxHospitalHeadcount} />
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>حضور اليوم: {hospital.attendanceToday}</span>
                  <span>إجازات معلقة: {hospital.pendingLeave}</span>
                </div>
              </div>
            ))}
            {!hospitalStats.length && <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">لا توجد مستشفيات مرتبطة بموظفين بعد.</div>}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
