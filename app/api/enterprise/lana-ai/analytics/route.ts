import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lana AI Real-Time Executive Analytics Endpoint (`/api/enterprise/lana-ai/analytics`)
 * Aggregates live operational metrics from Neon PostgreSQL (`ep-still-silence-at0ona1z`)
 * and generates an actionable, intelligent executive summary for `LanaAnalytics` widget.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [totalEmployees, activeHospitals, pendingApprovals, todayAttendance, pendingLeaves] = await Promise.all([
      prisma.employee.count({ where: { status: "ACTIVE" } }),
      prisma.hospital.count({ where: { isActive: true } }),
      prisma.workflowInstance.count({ where: { status: "PENDING" } }),
      prisma.attendanceRecord.count({ where: { workDate: { gte: todayStart } } }),
      prisma.leaveRequest.count({ where: { status: "PENDING" } })
    ]);

    let summary = "";
    if (pendingApprovals > 0 || pendingLeaves > 0) {
      summary = `يبلغ إجمالي القوى العاملة النشطة حالياً ${totalEmployees} موظفاً موزعين على ${activeHospitals} مستشفى وموقع طبي، مع تسجيل ${todayAttendance} حركة حضور وانصراف لليوم. 💡 تنبيه تنفيذي: يوجد (${pendingApprovals + pendingLeaves}) طلب معلق بانتظار الاعتماد المباشر في مسارات الإجازات وموافقات المستشفيات؛ يُوصى بمعالجتها لضمان انسيابية العمل.`;
    } else {
      summary = `إجمالي القوى العاملة النشطة ${totalEmployees} موظفاً عبر ${activeHospitals} مستشفى وموقع طبي، ولا توجد طلبات معلقة حالياً في مسارات الإجازات والموافقات.`;
    }

    return NextResponse.json({
      success: true,
      summary,
      metrics: {
        totalEmployees,
        activeHospitals,
        pendingApprovals: pendingApprovals + pendingLeaves,
        todayAttendance
      },
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
