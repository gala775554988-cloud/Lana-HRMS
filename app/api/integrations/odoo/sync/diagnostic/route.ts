import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OdooSyncService, requireOdooIntegrationAccess } from "@/lib/integrations/odoo/sync";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

function statusFor(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "Unauthorized") return 401;
  if (message === "Forbidden") return 403;
  return 500;
}

async function getEmployee3300Snapshot() {
  const emp = await prisma.employee.findFirst({
    where: {
      OR: [
        { employeeNumber: "3300" },
        { employeeNumber: "ODOO-3300" },
        { odooId: 3300 },
        { nationalId: "3300" }
      ]
    },
    include: {
      department: true,
      position: true,
      branch: true,
      attendanceRecords: {
        orderBy: { workDate: "desc" },
        take: 5
      }
    }
  });

  if (!emp) return null;

  return {
    id: emp.id,
    employeeNumber: emp.employeeNumber,
    nationalId: emp.nationalId,
    fullName: `${emp.firstName} ${emp.lastName}`.trim(),
    odooId: emp.odooId,
    status: emp.status,
    email: emp.email,
    phone: emp.phone,
    hasProfilePhoto: Boolean(emp.profilePhotoUrl),
    profilePhotoPreview: emp.profilePhotoUrl ? `${emp.profilePhotoUrl.slice(0, 45)}...` : null,
    departmentName: emp.department?.name || null,
    positionTitle: emp.position?.title || null,
    branchName: emp.branch?.name || null,
    sponsor: emp.sponsor,
    attendanceCount: await prisma.attendanceRecord.count({ where: { employeeId: emp.id } }),
    recentAttendance: emp.attendanceRecords.map(r => ({
      workDate: r.workDate,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      status: r.status
    }))
  };
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  try {
    // This is an interactive admin diagnostic/force-resync tool, not a
    // machine-to-machine bridge (that's what cron-sync's CRON_SECRET is
    // for) -- it must always require a real authenticated admin session.
    // A prior version accepted a hardcoded bypass token and silently
    // continued even when this check failed, leaving the route fully
    // unauthenticated despite being reachable without a login; do not
    // reintroduce a token bypass here.
    await requireOdooIntegrationAccess("manage");

    const action = request.nextUrl.searchParams.get("action") || "diagnostic";
    const connectionId = request.nextUrl.searchParams.get("connectionId") || undefined;
    const testIdParam = request.nextUrl.searchParams.get("testId") || "3300";

    const totalEmployees = await prisma.employee.count();
    const activeEmployees = await prisma.employee.count({ where: { status: "ACTIVE" } });
    const employeesWithOdooId = await prisma.employee.count({ where: { odooId: { not: null } } });
    const employeesWithPhotos = await prisma.employee.count({ where: { profilePhotoUrl: { not: null } } });
    const totalAttendanceRecords = await prisma.attendanceRecord.count();

    const snapshotBefore = await getEmployee3300Snapshot();

    if (action === "diagnostic") {
      return NextResponse.json({
        success: true,
        summary: {
          totalEmployees,
          activeEmployees,
          employeesWithOdooId,
          employeesWithPhotos,
          totalAttendanceRecords
        },
        testEmployeeSnapshot: snapshotBefore || { message: `Employee with testId ${testIdParam} not currently registered/found in DB.` }
      });
    }

    if (action === "force-sync" || action === "sync") {
      const service = await OdooSyncService.forConnection(connectionId);
      
      console.log(`[OdooDiagnostic] Starting forced employee sync...`);
      let employeeSyncResult: any;
      try {
        employeeSyncResult = await service.syncEmployees({ batchSize: 1000, direction: "ODOO_TO_LANA" });
      } catch (empErr: unknown) {
        employeeSyncResult = { success: false, error: empErr instanceof Error ? empErr.message : String(empErr) };
      }
      
      console.log(`[OdooDiagnostic] Starting forced attendance sync...`);
      let attendanceSyncResult: any;
      try {
        attendanceSyncResult = await service.syncAttendance({ batchSize: 2000, direction: "ODOO_TO_LANA" });
      } catch (attErr: unknown) {
        attendanceSyncResult = { success: false, error: attErr instanceof Error ? attErr.message : String(attErr) };
      }

      const snapshotAfter = await getEmployee3300Snapshot();
      const updatedTotalEmployees = await prisma.employee.count();
      const updatedEmployeesWithOdooId = await prisma.employee.count({ where: { odooId: { not: null } } });
      const updatedEmployeesWithPhotos = await prisma.employee.count({ where: { profilePhotoUrl: { not: null } } });
      const updatedTotalAttendanceRecords = await prisma.attendanceRecord.count();

      await writeAuditLog({
        action: "ODOO_FORCE_SYNC_DIAGNOSTIC",
        entity: "odoo",
        metadata: {
          employeeSyncResult,
          attendanceSyncResult,
          beforeCounts: { totalEmployees, employeesWithOdooId, employeesWithPhotos, totalAttendanceRecords },
          afterCounts: { totalEmployees: updatedTotalEmployees, employeesWithOdooId: updatedEmployeesWithOdooId, employeesWithPhotos: updatedEmployeesWithPhotos, totalAttendanceRecords: updatedTotalAttendanceRecords }
        }
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        message: "Forced Odoo synchronization completed successfully.",
        durationMs: Date.now() - startedAt,
        countsComparison: {
          before: {
            totalEmployees,
            employeesWithOdooId,
            employeesWithPhotos,
            totalAttendanceRecords
          },
          after: {
            totalEmployees: updatedTotalEmployees,
            employeesWithOdooId: updatedEmployeesWithOdooId,
            employeesWithPhotos: updatedEmployeesWithPhotos,
            totalAttendanceRecords: updatedTotalAttendanceRecords
          },
          delta: {
            employeesAdded: updatedTotalEmployees - totalEmployees,
            odooIdLinked: updatedEmployeesWithOdooId - employeesWithOdooId,
            photosAdded: updatedEmployeesWithPhotos - employeesWithPhotos,
            attendanceAdded: updatedTotalAttendanceRecords - totalAttendanceRecords
          }
        },
        testEmployee3300: {
          before: snapshotBefore || { status: "Not Found / Not Registered" },
          after: snapshotAfter || { status: "Not Found / Not Registered" }
        },
        syncResults: {
          employees: employeeSyncResult,
          attendance: attendanceSyncResult
        }
      });
    }

    return NextResponse.json({ success: false, message: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: statusFor(error) });
  }
}
