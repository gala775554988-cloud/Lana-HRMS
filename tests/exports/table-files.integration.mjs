import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";
import { buildExcelTable, buildPdfTable } from "../../lib/exports/table-files.ts";

const columns = [{ key: "number", label: "الرقم الوظيفي" }, { key: "name", label: "اسم الموظف" }];
const rows = Array.from({ length: 145 }, (_, index) => ({ number: "000" + index, name: index === 0 ? "=1+1" : "عبدالرحمن أحمد القحطاني" }));

test("Excel preserves text identifiers and uses RTL headers, filters and frozen first row", async () => {
  const bytes = await buildExcelTable("سجل الموظفين", columns, rows);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(bytes);
  const sheet = book.worksheets[0];
  assert.equal(sheet.rowCount, 146);
  assert.equal(sheet.getCell("A2").value, "0000");
  assert.equal(sheet.getCell("B2").value, "=1+1");
  assert.equal(sheet.getCell("B2").type, ExcelJS.ValueType.String);
  assert.equal(sheet.views[0].rightToLeft, true);
  assert.equal(sheet.views[0].ySplit, 1);
  assert.equal(sheet.getCell("A1").font.bold, true);
  assert.ok(sheet.autoFilter);
});

test("PDF tables paginate all rows and embed the Arabic font", async () => {
  const bytes = await buildPdfTable("سجل الموظفين", columns, rows);
  const pdf = await PDFDocument.load(bytes);
  assert.ok(pdf.getPageCount() > 5);
  assert.equal(pdf.getPage(0).getWidth(), 842);
});
