import { prisma } from "@/lib/prisma";

type CsvRow = Record<string, string> & { rowIndex: number };

type PlannedLeaveImport = {
  employee: { id: string; employeeNumber: string; odooId: number | null; odooRawData: unknown; leaveBalance: { accrued: unknown; used: unknown } | null };
  accrued: number;
  used: number;
  remaining: number;
  monthsAccrued: number;
  sourceId: string;
};

const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
const toLatinDigits = (value: unknown) => String(value ?? "").replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit)));
const normalize = (value: unknown) => toLatinDigits(value).trim().replace(/\s+/g, " ").toLowerCase();
const employeeIdKeys = (value: unknown) => {
  const normalized = normalize(value);
  if (!normalized) return [];
  const noLeadingZeros = normalized.replace(/^0+/, "") || "0";
  return Array.from(new Set([normalized, noLeadingZeros, `00${noLeadingZeros}`]));
};
const asNumber = (value: unknown) => {
  const parsed = Number.parseFloat(toLatinDigits(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
};
const toDateKey = (value: unknown) => {
  const text = toLatinDigits(value).trim();
  if (!text) return "";
  const parts = text.split("/").map(Number);
  // The supplied Odoo export uses month/day/year for Latin-digit dates.
  if (parts.length === 3 && parts.every(Number.isFinite)) {
    const [month, day, year] = parts;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

function parseSemicolonRow(line: string) {
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === ";" && !quoted) {
      fields.push(field.trim());
      field = "";
    } else field += char;
  }
  fields.push(field.trim());
  return fields;
}

export function parseLeaveCsv(csv: string): CsvRow[] {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  const [headerLine, ...rows] = lines;
  if (!headerLine) return [];
  const headers = parseSemicolonRow(headerLine);
  return rows.map((line, rowIndex) => {
    const values = parseSemicolonRow(line);
    return { ...Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])), rowIndex: rowIndex + 2 };
  });
}

export async function planLeaveCsvImport(csv: string) {
  const records = parseLeaveCsv(csv);
  const employees = await prisma.employee.findMany({
    select: {
      id: true,
      employeeNumber: true,
      odooId: true,
      firstName: true,
      lastName: true,
      hireDate: true,
      department: { select: { name: true } },
      position: { select: { title: true } },
      odooRawData: true,
      leaveBalance: { select: { accrued: true, used: true } },
    },
  });
  const byEmployeeNumber = new Map<string, (typeof employees)[number]>();
  for (const employee of employees) {
    for (const key of employeeIdKeys(employee.employeeNumber)) byEmployeeNumber.set(key, employee);
  }
  const byOdooId = new Map<string, (typeof employees)[number]>();
  for (const employee of employees.filter((employee) => employee.odooId !== null)) {
    for (const key of employeeIdKeys(employee.odooId)) byOdooId.set(key, employee);
  }
  const byName = new Map<string, typeof employees>();
  for (const employee of employees) {
    const key = normalize(`${employee.firstName} ${employee.lastName}`);
    byName.set(key, [...(byName.get(key) ?? []), employee]);
  }

  const planned: PlannedLeaveImport[] = [];
  const skipped: Array<{ row: number; id: string; name: string; reason: string }> = [];
  for (const row of records) {
    const sourceId = normalize(row.ID);
    const sourceName = normalize(row.name);
    // CSV exports sometimes contain a trailing separator-only row.
    if (!sourceId && !sourceName) continue;
    const accrued = asNumber(row["عدد الأيام المستحقة"]);
    const used = asNumber(row["كم المدة المقطوعة"]);
    const remaining = asNumber(row["المدة المتبقية"]);
    const monthsAccrued = asNumber(row["عددالاشهر المستحقة"]);
    // Non-employee header/admin rows in the export have no identifier and no
    // leave values; they are intentionally not employee entitlement rows.
    if (!sourceId && (sourceName === "system administrator" || [accrued, used, remaining, monthsAccrued].every((value) => value === null))) continue;
    let employee = employeeIdKeys(sourceId)
      .map((key) => byEmployeeNumber.get(key) || byOdooId.get(key))
      .find(Boolean);
    if (!employee && sourceName) {
      const matches = byName.get(sourceName) ?? [];
      if (matches.length === 1) employee = matches[0];
      else if (matches.length > 1) {
        const sourceHireDate = toDateKey(row.join_date);
        const sourceDepartment = normalize(row.department_id);
        const sourceJob = normalize(row.job_id);
        const exactProfileMatches = matches.filter((candidate) => {
          const candidateHireDate = candidate.hireDate.toISOString().slice(0, 10);
          return (!sourceHireDate || candidateHireDate === sourceHireDate)
            && (!sourceDepartment || normalize(candidate.department?.name) === sourceDepartment)
            && (!sourceJob || normalize(candidate.position?.title) === sourceJob);
        });
        if (exactProfileMatches.length === 1) {
          employee = exactProfileMatches[0];
        } else {
          skipped.push({
            row: row.rowIndex,
            id: row.ID,
            name: row.name,
            reason: `ambiguous employee name; candidates: ${matches.map((candidate) => `${candidate.employeeNumber} (Odoo ${candidate.odooId ?? "-"}, ${candidate.hireDate.toISOString().slice(0, 10)}, ${candidate.department?.name ?? "-"}, ${candidate.position?.title ?? "-"})`).join(", ")}`,
          });
          continue;
        }
      }
    }
    if (!employee) {
      skipped.push({ row: row.rowIndex, id: row.ID, name: row.name, reason: "employee not found" });
      continue;
    }
    if ([accrued, used, remaining, monthsAccrued].some((value) => value === null)) {
      skipped.push({ row: row.rowIndex, id: row.ID, name: row.name, reason: "invalid leave numeric value" });
      continue;
    }
    if (Math.abs((accrued! - used!) - remaining!) > 0.01) {
      skipped.push({ row: row.rowIndex, id: row.ID, name: row.name, reason: "accrued - used does not equal remaining" });
      continue;
    }
    planned.push({ employee, accrued: accrued!, used: used!, remaining: remaining!, monthsAccrued: monthsAccrued!, sourceId: row.ID });
  }
  return { totalRows: records.length, planned, skipped };
}

export async function applyLeaveCsvImport(planned: PlannedLeaveImport[], sourceFile: string) {
  const importedAt = new Date().toISOString();
  // Batches prevent an oversized transaction from exhausting a serverless DB
  // connection. This function is called only after a full dry-run with zero
  // skipped rows.
  for (let start = 0; start < planned.length; start += 100) {
    const batch = planned.slice(start, start + 100);
    await prisma.$transaction(batch.map(({ employee, accrued, used, remaining, monthsAccrued, sourceId }) => {
      const raw = (employee.odooRawData as Record<string, unknown> | null) ?? {};
      return prisma.employee.update({
        where: { id: employee.id },
        data: {
          leaveBalance: { upsert: { create: { accrued, used }, update: { accrued, used } } },
          odooRawData: {
            ...raw,
            _csvLeaveData: { monthsAccrued, daysAccrued: accrued, daysUsed: used, daysRemaining: remaining, importedAt, sourceCsv: sourceFile, sourceEmployeeId: sourceId },
          },
        },
      });
    }));
  }
}
