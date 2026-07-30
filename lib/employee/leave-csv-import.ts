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
const asNumber = (value: unknown) => {
  const parsed = Number.parseFloat(toLatinDigits(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
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
    select: { id: true, employeeNumber: true, odooId: true, firstName: true, lastName: true, odooRawData: true, leaveBalance: { select: { accrued: true, used: true } } },
  });
  const byEmployeeNumber = new Map(employees.map((employee) => [normalize(employee.employeeNumber), employee]));
  const byOdooId = new Map(employees.filter((employee) => employee.odooId !== null).map((employee) => [String(employee.odooId), employee]));
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
    const accrued = asNumber(row["عدد الأيام المستحقة"]);
    const used = asNumber(row["كم المدة المقطوعة"]);
    const remaining = asNumber(row["المدة المتبقية"]);
    const monthsAccrued = asNumber(row["عددالاشهر المستحقة"]);
    let employee = byEmployeeNumber.get(sourceId) || byOdooId.get(sourceId);
    if (!employee && sourceName) {
      const matches = byName.get(sourceName) ?? [];
      if (matches.length === 1) employee = matches[0];
      else if (matches.length > 1) {
        skipped.push({ row: row.rowIndex, id: row.ID, name: row.name, reason: "ambiguous employee name" });
        continue;
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
