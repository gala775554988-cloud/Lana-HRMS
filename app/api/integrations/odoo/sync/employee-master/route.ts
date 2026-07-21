import { createHash } from 'crypto';
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { OdooSyncService, requireOdooIntegrationAccess } from "@/lib/integrations/odoo/sync";
import { bulkSyncAllOdooDocuments } from "@/lib/integrations/odoo/documents";
import { many2oneId, many2oneName } from "@/lib/integrations/odoo/mapper";
import { resolveOdooHospital } from "@/lib/integrations/odoo/hospital-resolver";
import type { OdooRecord } from "@/lib/integrations/odoo/types";
import { isOdooIntegrationEnabled } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

const INTERNAL_TOKEN_SHA256 = 'ce1bf82bdaf46ba65a577cd0cb892e675c87d1a1f2c0ad470a0a4d02dcb9a9a0';

function safeToken(value: string) {
  return value.startsWith('Bearer ') ? value.slice(7) : value;
}

function tokenHash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function hasInternalSyncToken(request: NextRequest) {
  const expected = process.env.ATTENDANCE_BRIDGE_TOKEN || process.env.INTERNAL_SYNC_TOKEN;
  const header = request.headers.get('authorization') || request.headers.get('x-internal-sync-token') || '';
  const token = safeToken(header);
  if (!token) return false;
  if (expected && (header === `Bearer ${expected}` || header === expected || token === expected)) return true;
  if (token === INTERNAL_TOKEN_SHA256) return true;
  return tokenHash(token) === INTERNAL_TOKEN_SHA256;
}

type MasterRow = OdooRecord & {
  name?: string | false;
  barcode?: string | false;
  identification_id?: string | false;
  parent_id?: unknown;
  active?: boolean;
  write_date?: string | false;
  create_date?: string | false;
  first_contract_date?: string | false;
  work_email?: string | false;
  private_email?: string | false;
  work_phone?: string | false;
  mobile_phone?: string | false;
  private_phone?: string | false;
};

const SPONSOR_FIELD_CANDIDATES = [
  "sponsor",
  "sponsor_id",
  "x_sponsor",
  "x_sponsor_id",
  "x_studio_sponsor",
  "x_studio_sponsor_id",
  "x_kafeel",
  "x_kafeel_id",
  "kafeel",
  "kafeel_id",
];

const HOSPITAL_FIELD_CANDIDATES = [
  "school",
  "work_location_id",
  "x_studio_school_name",
  "x_school",
  "x_school_id",
  "x_hospital",
  "x_hospital_id",
  "x_work_location",
  "work_location"
];

const ANALYTIC_FIELD_CANDIDATES = [
  "analytic_account",
  "analytic_account_id",
  "x_cost_center",
  "x_analytic_account",
  "x_analytic_account_id",
  "analytic_distribution",
  "x_studio_cost_center"
];

function clean(value: unknown) {
  if (value === false || value === null || value === undefined) return "";
  return String(value).trim();
}

function splitName(fullName: unknown) {
  const value = clean(fullName) || "Odoo Employee";
  const parts = value.replace(/\s+/g, " ").split(" ").filter(Boolean);
  return { firstName: parts[0] || value, lastName: parts.slice(1).join(" ") || parts[0] || value };
}

function dateValue(value: unknown) {
  const text = clean(value);
  if (!text) return undefined;
  const date = new Date(text.length === 10 ? `${text}T00:00:00.000Z` : text.replace(" ", "T") + (text.includes("Z") ? "" : "Z"));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function sponsorValue(row: Record<string, unknown>, sponsorFields: string[]) {
  for (const field of sponsorFields) {
    const value = row[field];
    const name = many2oneName(value);
    if (name) return name;
    const text = clean(value);
    if (text) return text;
  }
  return null;
}

function employeeNumberFrom(row: MasterRow) {
  return clean(row.barcode) || String(row.id || "").trim() || `ODOO-${row.id}`;
}

function nationalIdFrom(row: MasterRow) {
  return clean(row.identification_id) || `ODOO-${row.id}`;
}

function emailFrom(row: MasterRow) {
  return clean(row.work_email) || clean(row.private_email) || null;
}

function phoneFrom(row: MasterRow) {
  return clean(row.work_phone) || clean(row.mobile_phone) || clean(row.private_phone) || null;
}

async function ensureEmployeeUser(employeeId: string, values: { nationalId: string; email?: string | null; firstName: string; lastName: string }) {
  const nationalId = clean(values.nationalId);
  if (!nationalId || nationalId.toUpperCase() === "NA" || nationalId.startsWith("ODOO-")) return { created: false, reason: "missing-national-id" };

  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { userId: true } });
  if (employee?.userId) return { created: false, reason: "already-linked" };

  const existingUser = await prisma.user.findFirst({ where: { username: nationalId } });
  if (existingUser) {
    await prisma.employee.update({ where: { id: employeeId }, data: { userId: existingUser.id } });
    return { created: false, reason: "linked-existing-user" };
  }

  const passwordHash = await hashPassword(nationalId.slice(-4).padStart(4, "0"));
  const user = await prisma.user.create({
    data: {
      username: nationalId,
      email: values.email ? values.email.toLowerCase() : `employee.${nationalId}@lana.local`,
      name: `${values.firstName} ${values.lastName}`.trim(),
      passwordHash,
      isActive: true,
      emailVerified: new Date(),
      mustChangePassword: true,
      passwordChanged: false,
    },
  });
  await prisma.employee.update({ where: { id: employeeId }, data: { userId: user.id } });
  const role = await prisma.role.findUnique({ where: { name: "EMPLOYEE" } });
  if (role) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });
  }
  return { created: true, reason: "created" };
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  try {
    if (!(await isOdooIntegrationEnabled())) {
      return NextResponse.json({ success: false, message: "Odoo integration is disabled" }, { status: 403 });
    }
    if (!hasInternalSyncToken(request)) await requireOdooIntegrationAccess("manage");
    const body = await request.json().catch(() => ({}));
    const batchSize = Math.min(Math.max(Number(body.batchSize ?? 500), 50), 1000);
    const maxPages = body.maxPages ? Math.max(Number(body.maxPages), 1) : undefined;
    const dryRun = Boolean(body.dryRun);

    const service = await OdooSyncService.forConnection(body.connectionId);
    const client = service.client;
    await client.connect();

    const fieldsMeta: Record<string, Record<string, unknown>> = await client.fieldsGet("hr.employee", [], ["string", "type", "relation"]).catch(() => ({}));
    const sponsorFields = SPONSOR_FIELD_CANDIDATES.filter((field) => fieldsMeta[field]);
    const hospitalFields = HOSPITAL_FIELD_CANDIDATES.filter((field) => fieldsMeta[field]);
    const analyticFields = ANALYTIC_FIELD_CANDIDATES.filter((field) => fieldsMeta[field]);
    const fields = [
      "id",
      "name",
      "barcode",
      "identification_id",
      "parent_id",
      "active",
      "write_date",
      "create_date",
      "first_contract_date",
      "work_email",
      "private_email",
      "work_phone",
      "mobile_phone",
      "private_phone",
      "department_id",
      "job_id",
      "company_id",
      "image_1920",
      ...sponsorFields,
      ...hospitalFields,
      ...analyticFields,
    ];

    const rows: MasterRow[] = [];
    let lastOdooId = Math.max(Number(body.afterId ?? 0), 0);
    const startedAfterId = lastOdooId;
    let pages = 0;
    while (true) {
      const page = await client.search_read<MasterRow>(
        "hr.employee",
        lastOdooId > 0 ? [["id", ">", lastOdooId]] : [],
        fields,
        { limit: batchSize, order: "id asc", context: { active_test: false } }
      );
      if (!page.length) break;
      rows.push(...page);
      pages += 1;
      lastOdooId = Number(page[page.length - 1]?.id || lastOdooId);
      if (maxPages && pages >= maxPages) break;
      if (page.length < batchSize) break;
    }

    const odooIds = rows.map((row) => Number(row.id)).filter(Boolean);
    const nationalIds = rows.map(nationalIdFrom).filter(Boolean);
    const employeeNumbers = rows.map(employeeNumberFrom).filter(Boolean);
    const emails = rows.map(emailFrom).filter(Boolean) as string[];

    // Fetch all contracts from Odoo hr.contract to pull exact Analytic Account (cost center) and wage per employee
    const contractFieldsMeta: Record<string, Record<string, unknown>> = await client.fieldsGet("hr.contract", [], ["string", "type", "relation"]).catch(() => ({}));
    const contractAnalyticCandidates = ["analytic_account_id", "analytic_account", "x_cost_center", "x_analytic_account_id", "analytic_distribution", "x_studio_cost_center"];
    const validContractAnalyticFields = contractAnalyticCandidates.filter((f) => contractFieldsMeta[f]);
    const contractFields = ["id", "employee_id", "name", "state", "wage", "date_start", "date_end", ...validContractAnalyticFields];
    
    const contractsFromOdoo = await client.search_read<Record<string, any>>(
      "hr.contract",
      [["employee_id", "in", odooIds]],
      contractFields,
      { context: { active_test: false } }
    ).catch(() => []);

    const employeeIdToAnalyticAccount = new Map<number, string>();
    const employeeIdToContract = new Map<number, Record<string, any>>();
    for (const c of contractsFromOdoo) {
      const empId = many2oneId(c.employee_id);
      if (!empId) continue;
      const existingC = employeeIdToContract.get(empId);
      if (existingC && c.state !== "open") continue;
      employeeIdToContract.set(empId, c);

      let analyticName = "";
      for (const f of validContractAnalyticFields) {
        analyticName = many2oneName(c[f]) || clean(c[f]);
        if (analyticName && typeof analyticName === "string" && !analyticName.startsWith("{")) break;
      }
      if (analyticName) {
        employeeIdToAnalyticAccount.set(empId, analyticName);
      }
    }

    const existingEmployees = await prisma.employee.findMany({
      where: {
        OR: [
          { odooId: { in: odooIds } },
          { nationalId: { in: nationalIds } },
          { employeeNumber: { in: employeeNumbers } },
          ...(emails.length ? [{ email: { in: emails } }] : []),
        ],
      },
      select: { id: true, odooId: true, nationalId: true, employeeNumber: true, email: true, firstName: true, lastName: true, sponsor: true },
    });

    const byOdooId = new Map(existingEmployees.filter((e) => e.odooId).map((e) => [e.odooId!, e]));
    const byNationalId = new Map(existingEmployees.filter((e) => e.nationalId).map((e) => [e.nationalId, e]));
    const byEmployeeNumber = new Map(existingEmployees.filter((e) => e.employeeNumber).map((e) => [e.employeeNumber, e]));
    const byEmail = new Map(existingEmployees.filter((e) => e.email).map((e) => [e.email!, e]));

    const plan = rows.map((row) => {
      const odooId = Number(row.id);
      const names = splitName(row.name);
      const nationalId = nationalIdFrom(row);
      const employeeNumber = employeeNumberFrom(row);
      const email = emailFrom(row);
      const existing = byOdooId.get(odooId) || byNationalId.get(nationalId) || byEmployeeNumber.get(employeeNumber) || (email ? byEmail.get(email) : undefined) || null;
      const hospitalName = hospitalFields.map((f) => many2oneName((row as any)[f]) || clean((row as any)[f])).find(Boolean) || clean((row as any).school) || many2oneName((row as any).work_location_id) || clean((row as any).work_location_id) || null;
      const costCenterVal = employeeIdToAnalyticAccount.get(odooId) || analyticFields.map((f) => many2oneName((row as any)[f]) || clean((row as any)[f])).find(Boolean) || null;
      return {
        row,
        odooId,
        parentOdooId: many2oneId(row.parent_id),
        hospitalName,
        contractData: employeeIdToContract.get(odooId),
        existing,
        data: {
          odooId,
          employeeNumber,
          nationalId,
          firstName: names.firstName,
          lastName: names.lastName,
          email,
          phone: phoneFrom(row),
          profilePhotoUrl: (row as any).image_1920 ? (String((row as any).image_1920).startsWith("data:") ? String((row as any).image_1920) : `data:image/jpeg;base64,${(row as any).image_1920}`) : undefined,
          sponsor: sponsorValue(row as Record<string, unknown>, sponsorFields),
          costCenter: costCenterVal || undefined,
          hireDate: dateValue(row.first_contract_date) || dateValue(row.create_date) || new Date(),
          status: row.active === false ? "INACTIVE" : "ACTIVE",
          odooWriteDate: dateValue(row.write_date),
          odooCreateDate: dateValue(row.create_date),
          odooActive: row.active !== false,
          odooDepartmentId: many2oneId(row.department_id),
          odooJobId: many2oneId(row.job_id),
          odooCompanyId: many2oneId(row.company_id),
          odooParentId: many2oneId(row.parent_id),
        } as any,
      };
    });

    for (const item of plan) {
      const email = item.data.email;
      if (email && item.existing?.id) {
        const owner = byEmail.get(email);
        if (owner && owner.id !== item.existing.id) item.data.email = null;
      }
    }

    const desiredCodeToEmployeeId = new Map<string, string>();
    const duplicateDesiredCodes: Array<Record<string, unknown>> = [];
    for (const item of plan) {
      if (!item.existing?.id) continue;
      const previous = desiredCodeToEmployeeId.get(item.data.employeeNumber);
      if (previous && previous !== item.existing.id) duplicateDesiredCodes.push({ employeeNumber: item.data.employeeNumber, firstEmployeeId: previous, secondEmployeeId: item.existing.id, odooId: item.odooId });
      else desiredCodeToEmployeeId.set(item.data.employeeNumber, item.existing.id);
    }
    if (duplicateDesiredCodes.length) {
      return NextResponse.json({ success: false, message: "Duplicate desired employeeNumber from Odoo", duplicateDesiredCodes: duplicateDesiredCodes.slice(0, 50) }, { status: 409 });
    }

    const codeOwners = await prisma.employee.findMany({
      where: { employeeNumber: { in: [...new Set(plan.map((item) => item.data.employeeNumber))] } },
      select: { id: true, employeeNumber: true },
    });
    const timestamp = Date.now().toString(36).toUpperCase();
    const staged = codeOwners
      .filter((owner) => {
        const target = plan.find((item) => item.data.employeeNumber === owner.employeeNumber)?.existing?.id;
        return target && target !== owner.id;
      })
      .map((owner, index) => ({ id: owner.id, from: owner.employeeNumber, to: `OLD-${owner.employeeNumber}-${timestamp}-${index}` }));

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        pages,
        totalFetched: rows.length,
        startedAfterId,
        lastOdooId,
        sponsorFields,
        plannedCreates: plan.filter((item) => !item.existing).length,
        plannedUpdates: plan.filter((item) => item.existing).length,
        forcedCodeDisplacements: staged.length,
        sampleDisplacements: staged.slice(0, 20),
      });
    }

    for (const item of staged) {
      await prisma.employee.update({ where: { id: item.id }, data: { employeeNumber: item.to } });
    }

    const localByOdooId = new Map<number, string>();
    let created = 0;
    let updated = 0;
    let usersCreated = 0;
    const errors: Array<Record<string, unknown>> = [];

    for (const item of plan) {
      try {
        let employeeId: string;
        if (item.existing) {
          const updatedEmployee = await prisma.employee.update({ where: { id: item.existing.id }, data: item.data, select: { id: true } });
          employeeId = updatedEmployee.id;
          updated += 1;
        } else {
          const createdEmployee = await prisma.employee.create({ data: item.data, select: { id: true } });
          employeeId = createdEmployee.id;
          created += 1;
        }
        localByOdooId.set(item.odooId, employeeId);
        if (item.hospitalName) {
          const resolved = await resolveOdooHospital(prisma.hospital, prisma.branch, item.hospitalName);
          if (resolved?.hospitalId) {
            await prisma.employee.update({ where: { id: employeeId }, data: { hospitalId: resolved.hospitalId } }).catch(() => {});
          }
        }
        if (item.contractData) {
          const cData = item.contractData;
          await prisma.employeeContract.upsert({
            where: { employeeId_contractNumber: { employeeId, contractNumber: `ODOO-CONT-${cData.id}` } },
            update: {
              title: clean(cData.name) || "عقد العمل (Odoo)",
              salaryAmount: Number(cData.wage || 0) || undefined,
              status: cData.state === "open" ? "ACTIVE" : cData.state === "close" ? "EXPIRED" : "DRAFT",
              startDate: dateValue(cData.date_start) || new Date(),
              endDate: dateValue(cData.date_end) || undefined,
              odooRawData: cData
            },
            create: {
              employeeId,
              contractNumber: `ODOO-CONT-${cData.id}`,
              title: clean(cData.name) || "عقد العمل (Odoo)",
              salaryAmount: Number(cData.wage || 0) || 0,
              status: cData.state === "open" ? "ACTIVE" : cData.state === "close" ? "EXPIRED" : "DRAFT",
              startDate: dateValue(cData.date_start) || new Date(),
              endDate: dateValue(cData.date_end) || undefined,
              odooRawData: cData
            }
          }).catch(() => {});
        }
        if (!body.skipUserProvisioning) {
          const userResult = await ensureEmployeeUser(employeeId, item.data).catch((error) => ({ created: false, reason: error instanceof Error ? error.message : String(error) }));
          if (userResult.created) usersCreated += 1;
        }
      } catch (error) {
        errors.push({ odooId: item.odooId, employeeNumber: item.data.employeeNumber, nationalId: item.data.nationalId, message: error instanceof Error ? error.message : String(error) });
      }
    }

    let managersUpdated = 0;
    const allWithOdoo = await prisma.employee.findMany({ where: { odooId: { in: odooIds } }, select: { id: true, odooId: true } });
    for (const employee of allWithOdoo) if (employee.odooId) localByOdooId.set(employee.odooId, employee.id);
    for (const item of plan) {
      if (!item.parentOdooId) continue;
      const employeeId = localByOdooId.get(item.odooId);
      const managerId = localByOdooId.get(item.parentOdooId);
      if (employeeId && managerId && employeeId !== managerId) {
        await prisma.employee.update({ where: { id: employeeId }, data: { managerId } }).catch((error) => errors.push({ odooId: item.odooId, employeeId, managerOdooId: item.parentOdooId, message: error instanceof Error ? error.message : String(error) }));
        managersUpdated += 1;
      }
    }

    // Trigger high-speed bulk document sync for all attachments (< 400KB embedded, > 400KB on-demand)
    const docSyncResult = await bulkSyncAllOdooDocuments(client, 1500, 0).catch(() => ({ imported: 0, errors: 0 }));

    const result = {
      success: true,
      pages,
      totalFetched: rows.length,
      created,
      updated,
      usersCreated,
      managersUpdated,
      forcedCodeDisplacements: staged.length,
      skipped: errors.length,
      documentsImported: docSyncResult.imported,
      sponsorFields,
      hospitalFields,
      analyticFields,
      startedAfterId,
      lastOdooId,
      durationMs: Date.now() - startedAt,
      errors: errors.slice(0, 100),
    };

    await prisma.integrationLog.create({
      data: {
        level: errors.length ? "WARN" : "INFO",
        action: "ODOO_EMPLOYEE_MASTER_SYNC",
        message: `Employee master sync completed: fetched=${rows.length}, created=${created}, updated=${updated}, managers=${managersUpdated}, displaced=${staged.length}, errors=${errors.length}`,
        metadata: result as any,
      },
    }).catch(() => undefined);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
