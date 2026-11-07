import ExcelJS from "exceljs";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";

export type ExportColumn = { key: string; label: string };
type ExportRow = Record<string, string | number | boolean | null>;

export async function buildExcelTable(title: string, columns: ExportColumn[], rows: ExportRow[]) {
  const book = new ExcelJS.Workbook();
  book.creator = "Lana HR";
  const sheet = book.addWorksheet(title.slice(0, 31), {
    views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  sheet.columns = columns.map(column => ({
    key: column.key, header: column.label,
    width: Math.min(45, Math.max(16, column.label.length + 4, ...rows.slice(0, 200).map(row => String(row[column.key] ?? "").length + 2))),
  }));
  for (const row of rows) sheet.addRow(columns.map(column => row[column.key]));
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, rows.length + 1), column: columns.length } };
  sheet.pageSetup.printTitlesRow = "1:1";
  sheet.eachRow((row, index) => {
    const lines = Math.max(1, ...columns.map((column, columnIndex) => Math.ceil(String(row.getCell(columnIndex + 1).value ?? "").length / Math.max(1, (sheet.getColumn(columnIndex + 1).width ?? 16) - 2))));
    row.height = index === 1 ? 30 : Math.max(28, lines * 16);
    row.eachCell({ includeEmpty: true }, cell => {
      cell.font = { name: "Arial", size: 11, bold: index === 1, color: { argb: index === 1 ? "FFFFFFFF" : "FF1E293B" } };
      cell.alignment = { vertical: "middle", horizontal: "right", wrapText: true, readingOrder: "rtl" };
      cell.border = { bottom: { style: "thin", color: { argb: "FFDDE3EC" } } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: index === 1 ? "FF294776" : index % 2 === 0 ? "FFF2F5FA" : "FFFFFFFF" } };
    });
  });
  return Buffer.from(await book.xlsx.writeBuffer());
}

export async function buildPdfTable(title: string, columns: ExportColumn[], rows: ExportRow[]) {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const font = await document.embedFont(await readFile(path.join(process.cwd(), "public/fonts/export-sans.ttf")), { subset: true });
  const pageWidth = 842;
  const pageHeight = 595;
  const margin = 28;
  const fontSize = 9;
  const lineHeight = 16;
  const maxColumns = 7;
  // Repeat the identifying column when wide reports continue on another set of pages.
  const groups: ExportColumn[][] = [];
  if (columns.length <= maxColumns) groups.push(columns);
  else {
    for (let offset = 1; offset < columns.length; offset += maxColumns - 1) groups.push([columns[0], ...columns.slice(offset, offset + maxColumns - 1)]);
  }
  const wrap = (value: unknown, width: number) => {
    const text = String(value ?? "—").replace(/[\r\n\t]+/g, " ");
    const lines: string[] = [];
    let line = "";
    for (const character of text) {
      if (line && font.widthOfTextAtSize(line + character, fontSize) > width) {
        lines.push(line);
        line = character;
      } else line += character;
    }
    lines.push(line || "—");
    return lines;
  };
  for (const group of groups) {
    const width = (pageWidth - margin * 2) / group.length;
    let page = document.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;
    const drawCell = (text: string, index: number, baseline: number, color = rgb(0.12, 0.17, 0.25)) => {
      const x = pageWidth - margin - (index + 1) * width;
      page.drawText(text, { x: x + width - 7 - font.widthOfTextAtSize(text, fontSize), y: baseline, font, size: fontSize, color });
    };
    const heading = () => {
      page.drawText(title, { x: pageWidth - margin - font.widthOfTextAtSize(title, 14), y, font, size: 14, color: rgb(0.16, 0.28, 0.46) });
      y -= 24;
      page.drawText(`Lana HR · ${rows.length} · ${new Date().toISOString().slice(0, 10)}`, { x: margin, y, font, size: 9 });
      y -= 16;
      const headerLines = group.map(column => wrap(column.label, width - 14));
      const height = Math.max(...headerLines.map(lines => lines.length)) * lineHeight + 12;
      page.drawRectangle({ x: margin, y: y - height, width: pageWidth - margin * 2, height, color: rgb(0.16, 0.28, 0.46) });
      headerLines.forEach((lines, index) => lines.forEach((line, lineIndex) => drawCell(line, index, y - 15 - lineIndex * lineHeight, rgb(1, 1, 1))));
      y -= height;
    };
    heading();
    rows.forEach((row, rowIndex) => {
      const cells = group.map(column => wrap(row[column.key], width - 14));
      const maxLines = Math.max(...cells.map(lines => lines.length));
      // Split exceptionally long values across pages, preserving every line.
      let offset = 0;
      while (offset < maxLines) {
        let capacity = Math.floor((y - margin - 12) / lineHeight);
        if (capacity < 1) { page = document.addPage([pageWidth, pageHeight]); y = pageHeight - margin; heading(); capacity = Math.floor((y - margin - 12) / lineHeight); }
        const count = Math.min(capacity, maxLines - offset);
        const height = count * lineHeight + 12;
        cells.forEach((lines, index) => {
          const x = pageWidth - margin - (index + 1) * width;
          page.drawRectangle({ x, y: y - height, width, height, color: rowIndex % 2 === 0 ? rgb(0.95, 0.96, 0.98) : rgb(1, 1, 1), borderColor: rgb(0.85, 0.88, 0.92), borderWidth: 0.5 });
          lines.slice(offset, offset + count).forEach((line, lineIndex) => drawCell(line, index, y - 15 - lineIndex * lineHeight));
        });
        y -= height;
        offset += count;
      }
    });
  }
  document.getPages().forEach((page, index, pages) => page.drawText(`${index + 1} / ${pages.length}`, { x: margin, y: 12, font, size: 8 }));
  return Buffer.from(await document.save());
}
