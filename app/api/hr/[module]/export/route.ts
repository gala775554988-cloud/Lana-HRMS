import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getHrmsModule } from "@/config/hrms";
import { listModuleRecords } from "@/lib/hrms/actions";

function flattenValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function safeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "export";
}

function escapePdfText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function buildSimplePdf(title: string, columns: string[], rows: Record<string, unknown>[]) {
  const lines = [
    title,
    `Generated: ${new Date().toISOString()}`,
    `Records: ${rows.length}`,
    "",
    columns.slice(0, 8).join(" | "),
    ...rows.slice(0, 120).map((row) => columns.slice(0, 8).map((column) => String(row[column] ?? "").slice(0, 32)).join(" | ")),
  ];

  const content = ["BT", "/F1 9 Tf", "40 800 Td"];
  for (const line of lines) {
    content.push(`(${escapePdfText(line)}) Tj`, "0 -13 Td");
  }
  content.push("ET");
  const stream = content.join("\n");

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream\nendobj\n`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += object;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "binary");
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const resource = getHrmsModule(module);
  if (!resource) return NextResponse.json({ error: "Unknown module" }, { status: 404 });

  const searchParams = request.nextUrl.searchParams;
  const format = (searchParams.get("format") || "xlsx").toLowerCase();
  const search = searchParams.get("search") || "";
  const filters = Object.fromEntries(resource.filterFields.map((field) => [field, searchParams.get(field) || undefined]));

  const allRecords: Record<string, unknown>[] = [];
  let page = 1;
  let pageCount = 1;
  do {
    const data = await listModuleRecords({ resourceKey: module, page, pageSize: 200, search, filters });
    if ("error" in data && data.error) {
      return NextResponse.json({ error: data.error }, { status: data.error === "Unauthorized" ? 401 : 403 });
    }
    allRecords.push(...data.records);
    pageCount = data.pageCount;
    page += 1;
  } while (page <= pageCount && page <= 50);

  const columns = Array.from(new Set(["id", ...resource.tableFields, ...resource.fields.map((field) => field.name), "createdAt", "updatedAt"]));
  const rows = allRecords.map((record) => Object.fromEntries(columns.map((column) => [column, flattenValue(record[column])] )));
  const baseName = `${safeFilename(resource.key)}-${new Date().toISOString().slice(0, 10)}`;

  if (format === "csv") {
    const sheet = XLSX.utils.json_to_sheet(rows, { header: columns });
    const csv = XLSX.utils.sheet_to_csv(sheet);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseName}.csv"`,
      },
    });
  }

  if (format === "pdf") {
    const buffer = buildSimplePdf(`${resource.title} Export`, columns, rows);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${baseName}.pdf"`,
      },
    });
  }

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows, { header: columns });
  XLSX.utils.book_append_sheet(workbook, sheet, resource.key.slice(0, 31));
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${baseName}.xlsx"`,
    },
  });
}
