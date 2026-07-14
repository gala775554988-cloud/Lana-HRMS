import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getHrmsModule } from "@/config/hrms";
import { listModuleRecords } from "@/lib/hrms/actions";
import { buildBrandedPdf } from "@/lib/pdf/branded-pdf";

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

async function buildSimplePdf(title: string, columns: string[], rows: Record<string, unknown>[]) {
  const lines = [
    `Generated: ${new Date().toISOString()}`,
    `Records: ${rows.length}`,
    "",
    columns.slice(0, 8).join(" | "),
    ...rows.slice(0, 120).map((row) => columns.slice(0, 8).map((column) => String(row[column] ?? "").slice(0, 32)).join(" | ")),
  ];
  return buildBrandedPdf(title, lines);
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
    const buffer = await buildSimplePdf(`${resource.title} Export`, columns, rows);
    return new NextResponse(new Uint8Array(buffer), {
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
