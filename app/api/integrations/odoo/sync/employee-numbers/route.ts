import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OdooClient } from "@/lib/integrations/odoo/client";
import { requireOdooIntegrationAccess } from "@/lib/integrations/odoo/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

type OdooEmployeeNumberRow = {
  id: number;
  barcode?: string | false;
  identification_id?: string | false;
  work_email?: string | false;
  name?: string | false;
  write_date?: string | false;
};

function clean(value: unknown) {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text && text.toUpperCase() !== "NA" ? text : undefined;
}

export async function POST(request: NextRequest) {
  try {
    await requireOdooIntegrationAccess("manage");
    const body = await request.json().catch(() => ({}));
    const batchSize = Math.min(Math.max(Number(body.batchSize ?? 1000), 100), 2000);
    const dryRun = Boolean(body.dryRun);

    const client = OdooClient.fromEnv();
    await client.connect();

    const localEmployees = await prisma.employee.findMany({
      select: { id: true, employeeNumber: true, nationalId: true, email: true, odooId: true },
      take: 20000,
    });
    const byOdooId = new Map<number, typeof localEmployees[number]>();
    const byEmployeeNumber = new Map<string, typeof localEmployees[number]>();
    const byNationalId = new Map<string, typeof localEmployees[number]>();
    const byEmail = new Map<string, typeof localEmployees[number]>();
    for (const employee of localEmployees) {
      if (typeof employee.odooId === "number") byOdooId.set(employee.odooId, employee);
      if (employee.employeeNumber) byEmployeeNumber.set(employee.employeeNumber, employee);
      if (employee.nationalId) byNationalId.set(employee.nationalId, employee);
      if (employee.email) byEmail.set(employee.email.toLowerCase(), employee);
    }

    let lastOdooId = 0;
    let fetched = 0;
    let updated = 0;
    let unchanged = 0;
    let skipped = 0;
    const errors: Array<Record<string, unknown>> = [];
    const samples: Array<Record<string, unknown>> = [];

    while (true) {
      const rows = await client.search_read<OdooEmployeeNumberRow>(
        "hr.employee",
        lastOdooId > 0 ? [["id", ">", lastOdooId]] : [],
        ["id", "barcode", "identification_id", "work_email", "name", "write_date"],
        { limit: batchSize, order: "id asc", context: { active_test: false } } as any
      );
      if (!rows.length) break;
      fetched += rows.length;
      lastOdooId = Number(rows[rows.length - 1].id || lastOdooId);

      for (const row of rows) {
        const odooId = Number(row.id);
        const correctEmployeeNumber = String(odooId);
        const barcode = clean(row.barcode);
        const nationalId = clean(row.identification_id);
        const email = clean(row.work_email)?.toLowerCase();

        const employee = byOdooId.get(odooId)
          || (barcode ? byEmployeeNumber.get(barcode) : undefined)
          || byEmployeeNumber.get(correctEmployeeNumber)
          || (nationalId ? byNationalId.get(nationalId) : undefined)
          || (email ? byEmail.get(email) : undefined);

        if (!employee) {
          skipped += 1;
          if (errors.length < 50) errors.push({ odooId, reason: "No matching local employee", barcode, nationalId, email, name: row.name });
          continue;
        }

        const occupied = byEmployeeNumber.get(correctEmployeeNumber);
        if (occupied && occupied.id !== employee.id) {
          skipped += 1;
          if (errors.length < 50) errors.push({ odooId, employeeId: employee.id, reason: "Correct employeeNumber already used by another employee", occupiedEmployeeId: occupied.id, correctEmployeeNumber });
          continue;
        }

        if (employee.employeeNumber === correctEmployeeNumber && employee.odooId === odooId) {
          unchanged += 1;
          continue;
        }

        if (!dryRun) {
          await prisma.employee.update({
            where: { id: employee.id },
            data: { employeeNumber: correctEmployeeNumber, odooId, odooWriteDate: row.write_date ? new Date(String(row.write_date).replace(" ", "T") + "Z") : undefined },
          });
          if (employee.employeeNumber) byEmployeeNumber.delete(employee.employeeNumber);
          employee.employeeNumber = correctEmployeeNumber;
          employee.odooId = odooId;
          byEmployeeNumber.set(correctEmployeeNumber, employee);
          byOdooId.set(odooId, employee);
        }
        updated += 1;
        if (samples.length < 25) samples.push({ employeeId: employee.id, oldEmployeeNumber: employee.employeeNumber, newEmployeeNumber: correctEmployeeNumber, odooId, barcode, nationalId, email });
      }

      if (rows.length < batchSize) break;
    }

    await prisma.auditLog.create({
      data: {
        action: dryRun ? "ODOO_EMPLOYEE_NUMBERS_DRY_RUN" : "ODOO_EMPLOYEE_NUMBERS_SYNC",
        entity: "employee",
        metadata: { fetched, updated, unchanged, skipped, errors: errors.slice(0, 20) } as any,
      },
    }).catch(() => undefined);

    return NextResponse.json({
      success: true,
      source: "hr.employee.id",
      dryRun,
      fetched,
      updated,
      unchanged,
      skipped,
      lastOdooId,
      samples,
      errors,
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
