import { NextRequest, NextResponse } from "next/server";
import { requireOdooIntegrationAccess, createOdooClientFromConnection } from "@/lib/integrations/odoo/sync";
import { many2oneName, many2oneId } from "@/lib/integrations/odoo/mapper";

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

export async function GET(request: NextRequest) {
  try {
    await requireOdooIntegrationAccess("manage");
    const connectionId = request.nextUrl.searchParams.get("connectionId") || undefined;

    const { client } = await createOdooClientFromConnection(connectionId);

    // Fetch all Odoo employees with active_test=false
    let lastId = 0;
    let hasMore = true;
    const batchSize = 500;
    const allEmployees: any[] = [];

    while (hasMore) {
      const domain: any[] = [];
      if (lastId > 0) domain.push(["id", ">", lastId]);

      const rows = await client.search_read(
        "hr.employee",
        domain,
        ["id", "name", "barcode", "identification_id", "work_email", "department_id", "job_id", "active", "write_date"],
        { limit: batchSize, order: "id asc", context: { active_test: false } } as any
      );

      if (!rows || rows.length === 0) {
        hasMore = false;
        break;
      }

      allEmployees.push(...rows);
      lastId = Number(rows[rows.length - 1].id) || lastId;

      if (rows.length < batchSize) hasMore = false;
    }

    // Group by nationalId (identification_id)
    const groups = new Map<string, any[]>();
    for (const emp of allEmployees) {
      const nid = emp.identification_id;
      // Skip false, null, empty, NA
      if (!nid || nid === false) continue;
      const str = String(nid).trim();
      if (str === "" || str.toUpperCase() === "NA") continue;
      const key = str;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(emp);
    }

    // Filter duplicates count >1
    const duplicates: Array<{ nationalId: string; count: number; employees: any[] }> = [];

    for (const [nationalId, emps] of groups.entries()) {
      if (emps.length > 1) {
        const employees = emps.map((e: any) => ({
          odooId: e.id,
          name: e.name || "",
          employeeNumber: e.barcode ? String(e.barcode) : `ODOO-${e.id}`,
          barcode: e.barcode ? String(e.barcode) : "",
          email: e.work_email ? String(e.work_email) : "",
          department: many2oneName(e.department_id) || "",
          departmentId: many2oneId(e.department_id) || null,
          job: many2oneName(e.job_id) || "",
          active: e.active !== false,
          write_date: e.write_date || null,
        }));
        duplicates.push({
          nationalId,
          count: emps.length,
          employees,
        });
      }
    }

    // Sort by count desc
    duplicates.sort((a, b) => b.count - a.count);

    const totalDuplicateEmployees = duplicates.reduce((sum, g) => sum + g.count, 0);
    const totalDuplicateNationalIds = duplicates.length;

    return NextResponse.json({
      success: true,
      duplicates,
      totalDuplicateEmployees,
      totalDuplicateNationalIds,
      totalEmployees: allEmployees.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined },
      { status: statusFor(error) }
    );
  }
}
