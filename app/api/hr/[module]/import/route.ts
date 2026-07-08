import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { revalidatePath } from "next/cache";
import { getHrmsModule } from "@/config/hrms";
import { createModuleRecord } from "@/lib/hrms/actions";

function parseCell(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try { return JSON.parse(trimmed); } catch { return trimmed; }
  }
  return trimmed;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const resource = getHrmsModule(module);
  if (!resource) return NextResponse.json({ success: false, error: "Unknown module" }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, error: "Import file is required" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return NextResponse.json({ success: false, error: "Workbook has no sheets" }, { status: 400 });

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: "" });
  const allowedFields = new Set(resource.fields.map((field) => field.name));
  let created = 0;
  const errors: Array<{ row: number; message: string }> = [];

  for (const [index, row] of rows.entries()) {
    const values = Object.fromEntries(
      Object.entries(row)
        .filter(([key]) => allowedFields.has(key))
        .map(([key, value]) => [key, parseCell(value)])
        .filter(([, value]) => value !== undefined)
    );
    if (Object.keys(values).length === 0) continue;
    const result = await createModuleRecord({ resourceKey: module, values }).catch((error: Error) => ({ success: false, message: error.message }));
    if (result.success) created += 1;
    else errors.push({ row: index + 2, message: result.message ?? "Import failed" });
  }

  revalidatePath(`/${module}`);

  const wantsJson = request.headers.get("accept")?.includes("application/json");
  if (!wantsJson) {
    const url = new URL(`/${module}`, request.url);
    url.searchParams.set("imported", String(created));
    if (errors.length) url.searchParams.set("importErrors", String(errors.length));
    return NextResponse.redirect(url, { status: 303 });
  }

  return NextResponse.json({ success: errors.length === 0, created, errors, totalRows: rows.length });
}
