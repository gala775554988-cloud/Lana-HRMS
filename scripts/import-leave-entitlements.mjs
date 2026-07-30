import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const DEFAULT_SOURCE = "/home/user/uploads/الاجازات_المستحقه (1).csv";
const sourceFile = process.argv.find((arg) => arg.startsWith("--file="))?.slice("--file=".length) || DEFAULT_SOURCE;
const apply = process.argv.includes("--apply");
const backupFile = process.argv.find((arg) => arg.startsWith("--backup="))?.slice("--backup=".length);

const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
const toLatinDigits = (value) => String(value ?? "").replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit)));
const normalize = (value) => toLatinDigits(value).trim().replace(/\s+/g, " ").toLowerCase();
const asNumber = (value) => {
  const parsed = Number.parseFloat(toLatinDigits(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
};

function parseSemicolonRow(line) {
  const fields = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ";" && !quoted) {
      fields.push(field.trim());
      field = "";
    } else {
      field += char;
    }
  }
  fields.push(field.trim());
  return fields;
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  const [headerLine, ...rows] = lines;
  const headers = parseSemicolonRow(headerLine);
  return rows.map((line, rowIndex) => {
    const values = parseSemicolonRow(line);
    return {
      ...Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
      rowIndex: rowIndex + 2,
    };
  });
}

const prisma = new PrismaClient();

async function main() {
  if (!fs.existsSync(sourceFile)) throw new Error(`CSV file not found: ${sourceFile}`);
  const records = parseCsv(fs.readFileSync(sourceFile, "utf8"));
  const employees = await prisma.employee.findMany({
    select: { id: true, employeeNumber: true, odooId: true, firstName: true, lastName: true, odooRawData: true, leaveBalance: true },
  });

  const byEmployeeNumber = new Map();
  const byOdooId = new Map();
  const byName = new Map();
  for (const employee of employees) {
    if (employee.employeeNumber) byEmployeeNumber.set(normalize(employee.employeeNumber), employee);
    if (employee.odooId !== null) byOdooId.set(String(employee.odooId), employee);
    const name = normalize(`${employee.firstName} ${employee.lastName}`);
    const entries = byName.get(name) ?? [];
    entries.push(employee);
    byName.set(name, entries);
  }

  const planned = [];
  const skipped = [];
  for (const row of records) {
    const employeeCode = normalize(row.ID);
    const name = normalize(row.name);
    const accrued = asNumber(row["عدد الأيام المستحقة"]);
    const used = asNumber(row["كم المدة المقطوعة"]);
    const remaining = asNumber(row["المدة المتبقية"]);
    const monthsAccrued = asNumber(row["عددالاشهر المستحقة"]);

    let employee = byEmployeeNumber.get(employeeCode) || byOdooId.get(employeeCode);
    if (!employee && name) {
      const matches = byName.get(name) ?? [];
      if (matches.length === 1) employee = matches[0];
      else if (matches.length > 1) {
        skipped.push({ row: row.rowIndex, id: row.ID, name: row.name, reason: "ambiguous employee name without matching ID" });
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
    if (Math.abs((accrued - used) - remaining) > 0.01) {
      skipped.push({ row: row.rowIndex, id: row.ID, name: row.name, reason: `inconsistent values: accrued(${accrued}) - used(${used}) != remaining(${remaining})` });
      continue;
    }

    planned.push({ employee, accrued, used, remaining, monthsAccrued, source: row });
  }

  console.log(JSON.stringify({ sourceFile, mode: apply ? "APPLY" : "DRY_RUN", totalRows: records.length, matched: planned.length, skipped: skipped.length, skippedSample: skipped.slice(0, 30) }, null, 2));
  if (!apply) return;
  if (skipped.length) throw new Error(`Refusing to apply a partial import: ${skipped.length} rows need review. Run without --apply for details.`);

  if (backupFile) {
    const backup = planned.map(({ employee }) => ({
      employeeId: employee.id,
      employeeNumber: employee.employeeNumber,
      odooId: employee.odooId,
      leaveBalance: employee.leaveBalance,
      csvLeaveData: employee.odooRawData?._csvLeaveData ?? null,
    }));
    fs.mkdirSync(path.dirname(backupFile), { recursive: true });
    fs.writeFileSync(backupFile, JSON.stringify({ createdAt: new Date().toISOString(), sourceFile, rows: backup }, null, 2));
  }

  await prisma.$transaction(planned.map(({ employee, accrued, used, remaining, monthsAccrued, source }) => {
    const raw = employee.odooRawData ?? {};
    return prisma.employee.update({
      where: { id: employee.id },
      data: {
        leaveBalance: { upsert: { create: { accrued, used }, update: { accrued, used } } },
        odooRawData: {
          ...raw,
          _csvLeaveData: {
            monthsAccrued,
            daysAccrued: accrued,
            daysUsed: used,
            daysRemaining: remaining,
            importedAt: new Date().toISOString(),
            sourceCsv: path.basename(sourceFile),
            sourceEmployeeId: source.ID,
          },
        },
      },
    });
  }));

  console.log(`Applied exact leave balances for ${planned.length} employees.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
