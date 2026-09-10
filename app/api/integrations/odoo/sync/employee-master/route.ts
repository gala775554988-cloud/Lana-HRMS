import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateTemporaryPassword, hashPassword } from "@/lib/password";
import { OdooSyncService, requireOdooIntegrationAccess } from "@/lib/integrations/odoo/sync";
import { bulkSyncAllOdooDocuments } from "@/lib/integrations/odoo/documents";
import { many2oneId, many2oneName } from "@/lib/integrations/odoo/mapper";
import { resolveOdooHospital } from "@/lib/integrations/odoo/hospital-resolver";
import type { OdooRecord } from "@/lib/integrations/odoo/types";
import { isOdooIntegrationEnabled } from "@/lib/settings";
import { hasValidInternalSyncToken } from "@/lib/internal-sync-auth";
import {
  EMPLOYEE_NUMBER_CANDIDATE_FIELDS,
  detectAuthoritativeEmployeeNumberField,
  getConfiguredEmployeeNumberField,
  resolveEmployeeNumberFromRecord,
  setConfiguredEmployeeNumberField,
} from "@/lib/integrations/odoo/employee-numbers";
import { discoverContractFields, odooStructureName, salaryProfileFromOdooContract } from "@/lib/integrations/odoo/contract-salary";
import { saveEmployeeSalaryProfile } from "@/lib/employee/salary-profile-store";
import { syncSocialInsuranceFromPayroll } from "@/lib/enterprise/social-insurance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

function hasInternalSyncToken(request: NextRequest) {
  return hasValidInternalSyncToken(request);
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

const EXTENDED_PROFILE_FIELD_CANDIDATES = [
  "employee_english_name", "english_name", "name_en", "x_employee_english_name", "x_studio_employee_english_name",
  "iqamah_job_name", "iqama_job_name", "profession", "profession_id", "x_iqamah_job_name", "x_studio_iqamah_job_name",
  "birthday", "gender", "marital", "join_date", "joining_date", "date_joining", "first_contract_date",
  "work_location_name", "employee_working_status", "working_status", "hr_presence_state", "is_absent", "tz", "category_ids", "branch_id",
  "emergency_contact", "emergency_phone", "private_street", "private_street2", "private_city", "private_state_id", "private_country_id", "private_zip",
  "address_home_id", "country_id", "place_of_birth"
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

function employeeNumberFrom(row: MasterRow, authoritativeField?: string | null) {
  return resolveEmployeeNumberFromRecord(row as Record<string, unknown>, authoritativeField)?.value || `ODOO-${row.id}`;
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

function firstText(row: Record<string, unknown>, fields: string[]) {
  for (const field of fields) {
    const value = many2oneName(row[field]) || clean(row[field]);
    if (value) return value;
  }
  return "";
}

function firstDate(row: Record<string, unknown>, fields: string[]) {
  for (const field of fields) {
    const value = dateValue(row[field]);
    if (value) return value;
  }
  return undefined;
}

function addressFrom(row: Record<string, unknown>) {
  const parts = ["private_street", "private_street2", "private_city", "private_state_id", "private_country_id", "private_zip"]
    .map((field) => many2oneName(row[field]) || clean(row[field]))
    .filter(Boolean);
  return parts.join("، ") || many2oneName(row.address_home_id) || clean(row.address_home_id) || undefined;
}

const SENSITIVE_RAW_FIELD = /(bank|iban|swift|account_number|credit_card)/i;

function safeEmployeeSnapshot(row: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(row).filter(([field]) => !SENSITIVE_RAW_FIELD.test(field) && field !== "image_1920"));
}

async function ensureEmployeeUser(employeeId: string, values: { nationalId: string; email?: string | null; firstName: string; lastName: string }) {
  const nationalId = clean(values.nationalId);
  if (!nationalId || nationalId.toUpperCase() === "NA" || nationalId.startsWith("ODOO-")) return { created: false, reason: "missing-national-id" };

  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { userId: true } });
  if (employee?.userId) return { created: false, reason: "already-linked" };

  const normalizedEmail = values.email ? values.email.trim().toLowerCase() : null;

  // Match by username (nationalId) first, then by email -- checking email too
  // prevents creating a second, disconnected User for someone who already has
  // an account (e.g. a manually-provisioned admin) that just isn't linked yet.
  const candidate =
    (await prisma.user.findFirst({ where: { username: nationalId }, select: { id: true, employeeProfile: { select: { id: true } } } })) ||
    (normalizedEmail
      ? await prisma.user.findFirst({ where: { email: { equals: normalizedEmail, mode: "insensitive" } }, select: { id: true, employeeProfile: { select: { id: true } } } })
      : null);

  if (candidate) {
    if (candidate.employeeProfile && candidate.employeeProfile.id !== employeeId) {
      // Already linked to a different Employee -- a genuine identity conflict.
      // Never silently steal the link; leave for manual review.
      return { created: false, reason: "conflict-different-employee" };
    }
    await prisma.employee.update({ where: { id: employeeId }, data: { userId: candidate.id } });
    return { created: false, reason: "linked-existing-user" };
  }

  const passwordHash = await hashPassword(generateTemporaryPassword());
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
    const extendedProfileFields = EXTENDED_PROFILE_FIELD_CANDIDATES.filter((field) => fieldsMeta[field]);
    const employeeNumberFields = [
      ...EMPLOYEE_NUMBER_CANDIDATE_FIELDS.filter((field) => fieldsMeta[field]),
      ...Object.keys(fieldsMeta).filter((field) => /^x_.*(employee|emp|badge).*(number|code|no|id)$/i.test(field)),
    ];
    const requestedFields = [
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
      ...extendedProfileFields,
      ...employeeNumberFields,
    ];
    const fields = requestedFields.filter((field, index) =>
      (field === "id" || Boolean(fieldsMeta[field])) && requestedFields.indexOf(field) === index
    );

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

    const configuredEmployeeNumberField = await getConfiguredEmployeeNumberField(true);
    const detectedEmployeeNumberField = detectAuthoritativeEmployeeNumberField(rows, Object.keys(fieldsMeta));
    const configuredCoverage = configuredEmployeeNumberField && rows.length
      ? rows.filter((row) => resolveEmployeeNumberFromRecord(row as Record<string, unknown>, configuredEmployeeNumberField)?.source === configuredEmployeeNumberField).length / rows.length
      : 0;
    // Preserve a configured source that is still populated. This prevents a
    // partial/paginated batch from accidentally changing the source of truth.
    const authoritativeEmployeeNumberField = configuredCoverage >= 0.5
      ? configuredEmployeeNumberField
      : detectedEmployeeNumberField?.field || configuredEmployeeNumberField;
    if (detectedEmployeeNumberField && authoritativeEmployeeNumberField === detectedEmployeeNumberField.field && !dryRun) {
      await setConfiguredEmployeeNumberField(detectedEmployeeNumberField);
    }

    const odooIds = rows.map((row) => Number(row.id)).filter(Boolean);
    const nationalIds = rows.map(nationalIdFrom).filter(Boolean);
    const employeeNumbers = rows.map((row) => employeeNumberFrom(row, authoritativeEmployeeNumberField)).filter(Boolean);
    const emails = rows.map(emailFrom).filter(Boolean) as string[];

    // Fetch all contracts from Odoo hr.contract to pull exact Analytic Account (cost center) and wage per employee
    const contractFieldsMeta: Record<string, Record<string, unknown>> = await client.fieldsGet("hr.contract", [], ["string", "type", "relation"]).catch(() => ({}));
    const contractAnalyticCandidates = ["analytic_account_id", "analytic_account", "x_cost_center", "x_analytic_account_id", "analytic_distribution", "x_studio_cost_center"];
    const validContractAnalyticFields = contractAnalyticCandidates.filter((f) => contractFieldsMeta[f]);
    const contractFields = discoverContractFields(contractFieldsMeta, validContractAnalyticFields);
    
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
      const employeeNumberResolution = resolveEmployeeNumberFromRecord(row as Record<string, unknown>, authoritativeEmployeeNumberField);
      const employeeNumber = employeeNumberResolution?.value || `ODOO-${row.id}`;
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
          employeeEnglishName: firstText(row, ["employee_english_name", "english_name", "name_en", "x_employee_english_name", "x_studio_employee_english_name"]) || undefined,
          iqamahJobName: firstText(row, ["iqamah_job_name", "iqama_job_name", "profession", "profession_id", "x_iqamah_job_name", "x_studio_iqamah_job_name"]) || undefined,
          workPhone: clean((row as any).work_phone) || undefined,
          mobilePhone: clean((row as any).mobile_phone) || undefined,
          gender: clean((row as any).gender) || undefined,
          dateOfBirth: dateValue((row as any).birthday),
          address: addressFrom(row),
          emergencyContact: [firstText(row, ["emergency_contact"]), firstText(row, ["emergency_phone"])].filter(Boolean).join(" - ") || undefined,
          maritalStatus: clean((row as any).marital) || undefined,
          firstContractDate: firstDate(row, ["first_contract_date", "join_date", "joining_date", "date_joining"]),
          workingStatus: firstText(row, ["employee_working_status", "working_status"]) || undefined,
          hrPresenceState: clean((row as any).hr_presence_state) || undefined,
          isAbsent: Boolean((row as any).is_absent),
          odooTimezone: clean((row as any).tz) || "Asia/Riyadh",
          odooTags: Array.isArray((row as any).category_ids) ? (row as any).category_ids : undefined,
          workLocationName: clean((row as any).work_location_name) || many2oneName((row as any).work_location_id) || undefined,
          costCenter: costCenterVal || undefined,
          hireDate: firstDate(row, ["join_date", "joining_date", "date_joining", "first_contract_date", "create_date"]) || new Date(),
          status: row.active === false ? "INACTIVE" : "ACTIVE",
          odooWriteDate: dateValue(row.write_date),
          odooCreateDate: dateValue(row.create_date),
          odooActive: row.active !== false,
          odooDepartmentId: many2oneId(row.department_id),
          odooJobId: many2oneId(row.job_id),
          odooCompanyId: many2oneId(row.company_id),
          odooParentId: many2oneId(row.parent_id),
          odooRawData: safeEmployeeSnapshot(row as Record<string, unknown>),
          odooRawDataSyncedAt: new Date(),
        } as any,
        employeeNumberSource: employeeNumberResolution?.source || null,
        missingNationalId: !clean(row.identification_id),
        missingHireDate: !firstDate(row, ["join_date", "joining_date", "date_joining", "first_contract_date", "create_date"]),
      };
    });

    // Validate the complete batch before any write. A bad reference or missing
    // critical identity value blocks the batch and is logged for review rather
    // than producing partial, silent updates.
    const validationErrors = plan.flatMap((item) => {
      const issues: string[] = [];
      if (!item.odooId || !Number.isInteger(item.odooId)) issues.push("Missing or invalid Odoo employee id");
      if (!clean(item.data.employeeNumber)) issues.push("Missing employee number");
      if (!clean(item.data.nationalId)) issues.push("Missing national ID / Iqama");
      if (!clean(item.data.firstName) || !clean(item.data.lastName)) issues.push("Missing employee name");
      if (!(item.data.hireDate instanceof Date) || Number.isNaN(item.data.hireDate.getTime())) issues.push("Missing or invalid hire date");
      if (item.contractData) {
        if (!Number(item.contractData.id)) issues.push("Contract record has no Odoo id");
        if (!dateValue(item.contractData.date_start)) issues.push("Contract has no valid start date");
        if (!Number.isFinite(Number(item.contractData.wage))) issues.push("Contract has invalid wage");
      }
      return issues.map((message) => ({ odooId: item.odooId, employeeNumber: item.data.employeeNumber, message }));
    });
    if (validationErrors.length) {
      await prisma.integrationLog.create({ data: { level: "ERROR", action: "ODOO_EMPLOYEE_MASTER_VALIDATION", message: `Odoo employee master sync blocked: ${validationErrors.length} validation error(s)`, metadata: { errors: validationErrors.slice(0, 100) } as any } }).catch(() => undefined);
      return NextResponse.json({ success: false, blocked: true, message: "Sync blocked by pre-write validation", validationErrors: validationErrors.slice(0, 100) }, { status: 422 });
    }

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
        authoritativeEmployeeNumberField,
        quality: {
          complete: plan.every((item) => Boolean(item.employeeNumberSource) && !item.missingNationalId && !item.missingHireDate),
          missingOfficialEmployeeNumber: plan.filter((item) => !item.employeeNumberSource).length,
          missingNationalId: plan.filter((item) => item.missingNationalId).length,
          missingHireDate: plan.filter((item) => item.missingHireDate).length,
        },
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
        // Bank account and IBAN data are explicitly excluded from the Odoo
        // request, plan, logs, raw snapshots, and all Prisma writes.
        if (item.hospitalName) {
          const resolved = await resolveOdooHospital(prisma.hospital, prisma.branch, item.hospitalName);
          if (resolved?.hospitalId) {
            await prisma.employee.update({ where: { id: employeeId }, data: { hospitalId: resolved.hospitalId } }).catch(() => {});
          }
        }
        if (item.contractData) {
          const cData = item.contractData;
          const salaryProfile = salaryProfileFromOdooContract(cData);
          const structureName = odooStructureName(cData);
          await prisma.employeeContract.upsert({
            where: { contractNumber: `ODOO-CONT-${cData.id}` },
            update: {
              employeeId,
              title: clean(cData.name) || "عقد العمل (Odoo)",
              salaryAmount: Number(cData.wage || 0) || undefined,
              currency: "SAR",
              status: cData.state === "open" ? "ACTIVE" : cData.state === "close" ? "EXPIRED" : "DRAFT",
              startDate: dateValue(cData.date_start) || new Date(),
              endDate: dateValue(cData.date_end) || undefined,
              odooId: Number(cData.id),
              odooEmployeeId: item.odooId,
              odooWriteDate: dateValue(cData.write_date),
              odooState: clean(cData.state) || undefined,
              odooStructureType: structureName,
              salaryDetails: salaryProfile as any,
              odooRawData: cData
            },
            create: {
              employeeId,
              contractNumber: `ODOO-CONT-${cData.id}`,
              title: clean(cData.name) || "عقد العمل (Odoo)",
              salaryAmount: Number(cData.wage || 0) || 0,
              currency: "SAR",
              status: cData.state === "open" ? "ACTIVE" : cData.state === "close" ? "EXPIRED" : "DRAFT",
              startDate: dateValue(cData.date_start) || new Date(),
              endDate: dateValue(cData.date_end) || undefined,
              odooId: Number(cData.id),
              odooEmployeeId: item.odooId,
              odooWriteDate: dateValue(cData.write_date),
              odooState: clean(cData.state) || undefined,
              odooStructureType: structureName,
              salaryDetails: salaryProfile as any,
              odooRawData: cData
            }
          });
          await saveEmployeeSalaryProfile(employeeId, salaryProfile);
          await syncSocialInsuranceFromPayroll(employeeId, salaryProfile).catch(() => null);
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

    const quality = {
      complete: errors.length === 0 && plan.every((item) => Boolean(item.employeeNumberSource) && !item.missingNationalId && !item.missingHireDate),
      missingOfficialEmployeeNumber: plan.filter((item) => !item.employeeNumberSource).length,
      missingNationalId: plan.filter((item) => item.missingNationalId).length,
      missingHireDate: plan.filter((item) => item.missingHireDate).length,
      contractsFound: plan.filter((item) => Boolean(item.contractData)).length,
      salaryProfilesSynced: plan.filter((item) => Boolean(item.contractData?.wage)).length,
    };
    const result = {
      success: errors.length === 0,
      complete: quality.complete,
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
      authoritativeEmployeeNumberField,
      contractFields,
      quality,
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
