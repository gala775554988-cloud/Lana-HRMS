#!/usr/bin/env node
/**
 * generate-department-attendance-report.mjs
 * ---------------------------------------------------------------
 * Generates one styled Excel workbook per department:
 *   - Attendance table (first/last punch per employee/day)
 *   - Absence table (employees with no recorded check-in that day)
 *
 * Uses this project's own @prisma/client (same models/columns as the
 * rest of Lana HRMS -- Employee.employeeNumber, not employeeCode) so
 * it needs no separate DATABASE_URL parsing/pgbouncer handling: it
 * reads the same .env.local the app itself uses.
 *
 * Absence detection is done in JS (fetch employees + attended dates,
 * diff in memory) rather than a recursive-CTE date range in raw SQL,
 * matching how lib/enterprise/leave-engine.ts already does absentee
 * lookups elsewhere in this codebase.
 *
 * Run:
 *   START_DATE=2026-06-01 END_DATE=2026-06-30 node scripts/generate-department-attendance-report.mjs
 *
 * Output: one .xlsx per department under ./reports
 * Requires: npm install exceljs (not needed by the app itself, only this script)
 * ---------------------------------------------------------------
 */

import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// Unlike `next dev`/`next build`, a plain `node script.mjs` never auto-loads
// .env.local -- without this, DATABASE_URL is simply unset when running
// this script locally.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const prisma = new PrismaClient();

const START_DATE = process.env.START_DATE || "2026-07-01";
const END_DATE = process.env.END_DATE || "2026-07-31";
const OUTPUT_DIR = process.env.OUTPUT_DIR || "./reports";

const DAY_NAMES_AR = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function dayNameAr(date) {
  return DAY_NAMES_AR[new Date(date).getDay()];
}

function fmtTime(ts) {
  if (!ts) return "";
  // Force plain Western digits (ar-EG's default numbering system is
  // Arabic-Indic, e.g. "١٧:٠٠" instead of "17:00") to match the reference
  // report format.
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function fmtDate(d) {
  return new Date(d).toISOString().slice(0, 10);
}

function dateRange(startDate, endDate) {
  const dates = [];
  const cur = new Date(startDate);
  const end = new Date(endDate);
  while (cur <= end) {
    dates.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

async function getDepartments() {
  return prisma.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
}

async function getAttendance(departmentId, startDate, endDate) {
  const records = await prisma.attendanceRecord.findMany({
    where: {
      employee: { departmentId },
      workDate: { gte: new Date(startDate), lte: new Date(endDate) },
      checkIn: { not: null },
    },
    select: {
      workDate: true,
      checkIn: true,
      checkOut: true,
      employee: { select: { employeeNumber: true, firstName: true, department: { select: { name: true } } } },
    },
    orderBy: [{ employee: { employeeNumber: "asc" } }, { workDate: "asc" }],
  });
  return records.map((r) => ({
    emp_code: r.employee.employeeNumber,
    first_name: r.employee.firstName,
    dept_name: r.employee.department?.name ?? "",
    work_date: r.workDate,
    check_in: r.checkIn,
    check_out: r.checkOut,
  }));
}

async function getAbsences(departmentId, startDate, endDate) {
  const employees = await prisma.employee.findMany({
    where: { departmentId, status: "ACTIVE" },
    select: { id: true, employeeNumber: true, firstName: true, department: { select: { name: true } } },
    orderBy: { employeeNumber: "asc" },
  });

  const attended = await prisma.attendanceRecord.findMany({
    where: {
      employee: { departmentId },
      workDate: { gte: new Date(startDate), lte: new Date(endDate) },
      checkIn: { not: null },
    },
    select: { employeeId: true, workDate: true },
  });
  const attendedSet = new Set(attended.map((a) => `${a.employeeId}|${fmtDate(a.workDate)}`));

  const rows = [];
  for (const day of dateRange(startDate, endDate)) {
    const dayKey = fmtDate(day);
    for (const emp of employees) {
      if (!attendedSet.has(`${emp.id}|${dayKey}`)) {
        rows.push({
          emp_code: emp.employeeNumber,
          first_name: emp.firstName,
          dept_name: emp.department?.name ?? "",
          work_date: day,
        });
      }
    }
  }
  return rows;
}

async function buildWorkbookForDepartment(deptName, attendance, absences) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(deptName, { views: [{ rightToLeft: true }] });

  const FONT = { name: "Arial" };
  const TITLE_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
  const HEADER_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFBFBFBF" } };
  const YELLOW_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };
  const THIN_BORDER = {
    top: { style: "thin", color: { argb: "FF999999" } },
    left: { style: "thin", color: { argb: "FF999999" } },
    bottom: { style: "thin", color: { argb: "FF999999" } },
    right: { style: "thin", color: { argb: "FF999999" } },
  };
  const CENTER = { horizontal: "center", vertical: "middle" };

  // ===== Attendance table: A:G =====
  ws.mergeCells("A1:G1");
  ws.getCell("A1").value = `حضور وانصراف ${deptName}`;
  ws.getCell("A1").font = { ...FONT, bold: true, size: 13 };
  ws.getCell("A1").fill = TITLE_FILL;
  ws.getCell("A1").alignment = CENTER;

  const attHeaders = ["آخر تسجيل خروج", "أول تسجيل دخول", "اليوم", "التاريخ", "القسم", "الإسم الأول", "رقم الموظف"];
  attHeaders.forEach((h, i) => {
    const c = ws.getCell(2, i + 1);
    c.value = h;
    c.font = { ...FONT, bold: true };
    c.fill = HEADER_FILL;
    c.alignment = CENTER;
    c.border = THIN_BORDER;
  });

  let rowNum = 3;
  let lastEmp = null;
  let highlight = false;
  for (const r of attendance) {
    if (r.emp_code !== lastEmp) {
      highlight = !highlight;
      lastEmp = r.emp_code;
    }
    const values = [
      fmtTime(r.check_out),
      fmtTime(r.check_in),
      dayNameAr(r.work_date),
      fmtDate(r.work_date),
      r.dept_name,
      r.first_name,
      r.emp_code,
    ];
    values.forEach((v, i) => {
      const c = ws.getCell(rowNum, i + 1);
      c.value = v;
      c.font = FONT;
      c.alignment = CENTER;
      c.border = THIN_BORDER;
      if (highlight) c.fill = YELLOW_FILL;
    });
    rowNum++;
  }

  ws.autoFilter = "A2:G2";
  ws.columns = [
    { width: 16 }, { width: 16 }, { width: 12 }, { width: 12 },
    { width: 12 }, { width: 24 }, { width: 12 },
  ];

  // ===== Absence table: J:N (gap H:I) =====
  const absStartCol = 10; // J
  ws.mergeCells(1, absStartCol, 1, absStartCol + 4);
  const absTitle = ws.getCell(1, absStartCol);
  absTitle.value = "غيابات الموظفين";
  absTitle.font = { ...FONT, bold: true, size: 13 };
  absTitle.fill = TITLE_FILL;
  absTitle.alignment = CENTER;

  const absHeaders = ["اليوم", "التاريخ", "القسم", "الإسم الأول", "رقم الموظف"];
  absHeaders.forEach((h, i) => {
    const c = ws.getCell(2, absStartCol + i);
    c.value = h;
    c.font = { ...FONT, bold: true };
    c.fill = HEADER_FILL;
    c.alignment = CENTER;
    c.border = THIN_BORDER;
  });

  rowNum = 3;
  for (const r of absences) {
    const values = [dayNameAr(r.work_date), fmtDate(r.work_date), r.dept_name, r.first_name, r.emp_code];
    values.forEach((v, i) => {
      const c = ws.getCell(rowNum, absStartCol + i);
      c.value = v;
      c.font = FONT;
      c.alignment = CENTER;
      c.border = THIN_BORDER;
    });
    rowNum++;
  }

  ws.getColumn(absStartCol).width = 14;
  ws.getColumn(absStartCol + 1).width = 20;
  ws.getColumn(absStartCol + 2).width = 12;
  ws.getColumn(absStartCol + 3).width = 24;
  ws.getColumn(absStartCol + 4).width = 12;

  ws.views = [{ state: "frozen", ySplit: 2, rightToLeft: true }];

  return wb;
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const departments = await getDepartments();
  console.log(`تم العثور على ${departments.length} قسم. جاري توليد التقارير من ${START_DATE} إلى ${END_DATE}...`);

  for (const dept of departments) {
    const attendance = await getAttendance(dept.id, START_DATE, END_DATE);
    const absences = await getAbsences(dept.id, START_DATE, END_DATE);
    const wb = await buildWorkbookForDepartment(dept.name, attendance, absences);

    const safeName = dept.name.replace(/[\\/:*?"<>|]/g, "_");
    const filePath = path.join(OUTPUT_DIR, `تقرير_حضور_وغياب_${safeName}.xlsx`);
    await wb.xlsx.writeFile(filePath);
    console.log(`✔ ${dept.name}: ${attendance.length} سجل حضور، ${absences.length} يوم غياب -> ${filePath}`);
  }

  await prisma.$disconnect();
  console.log("انتهى التوليد بنجاح.");
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
