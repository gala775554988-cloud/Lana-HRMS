import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getHrmsModule } from "@/config/hrms";
import { listModuleRecords } from "@/lib/hrms/actions";
import { buildExcelTable, buildPdfTable } from "@/lib/exports/table-files";
import { getRequestDictionary } from "@/lib/i18n-server";

const employeeLabels: Record<string, string> = {
  employeeNumber: "الرقم الوظيفي", firstName: "الاسم الأول", lastName: "اسم العائلة", nationalId: "الهوية / الإقامة",
  email: "البريد الإلكتروني", phone: "الجوال", department: "الإدارة", position: "المسمى الوظيفي",
  branch: "الفرع", employmentType: "نوع التوظيف", status: "الحالة", hireDate: "تاريخ التعيين",
};
const statusLabels: Record<string, string> = {
  ACTIVE: "نشط", INACTIVE: "غير نشط", ON_LEAVE: "في إجازة", TERMINATED: "منتهية خدمته",
  AVAILABLE: "متاح", ASSIGNED: "عهدة موظف", APPROVED: "معتمد", REJECTED: "مرفوض", PENDING: "قيد المراجعة",
};
function valueOf(value: unknown, key: string): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const relation = value as { name?: string; title?: string };
    return relation.name ?? relation.title ?? null;
  }
  if (key === "status") return statusLabels[String(value)] ?? String(value);
  return typeof value === "number" || typeof value === "boolean" ? value : String(value);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const resource = getHrmsModule(module);
  if (!resource) return NextResponse.json({ error: "Unknown module" }, { status: 404 });
  const query = request.nextUrl.searchParams;
  const format = query.get("format") ?? "xlsx";
  if (!["xlsx", "pdf", "csv"].includes(format)) return NextResponse.json({ error: "صيغة تصدير غير صالحة" }, { status: 400 });
  const search = query.get("search") ?? "";
  const filterNames = module === "employees"
    ? [...resource.filterFields, "department", "branch", "hospital", "project", "section", "position", "nationality", "employmentType", "manager", "sponsor", "nationalId", "hireDate"]
    : resource.filterFields;
  const filters = Object.fromEntries(filterNames.map(field => [field, query.get(field) || undefined]));
  const allRecords: Record<string, unknown>[] = [];
  let page = 1;
  let pageCount = 1;
  do {
    const data = await listModuleRecords({ resourceKey: module, page, pageSize: 200, search, filters });
    if ("error" in data && data.error) return NextResponse.json({ error: data.error }, { status: data.error === "Unauthorized" ? 401 : 403 });
    allRecords.push(...data.records);
    pageCount = data.pageCount;
    if (pageCount > 50) return NextResponse.json({ error: "النتيجة تتجاوز 10000 سجل. ضيّق الفلاتر ثم أعد التصدير." }, { status: 413 });
    page++;
  } while (page <= pageCount);
  const available = module === "employees" ? Object.keys(employeeLabels) : Array.from(new Set([...resource.tableFields, ...resource.fields.map(field => field.name)]));
  const requested = query.get("fields")?.split(",").map(field => field.trim()).filter(Boolean);
  if (requested?.some(field => !available.includes(field))) return NextResponse.json({ error: "حقل تصدير غير متاح" }, { status: 400 });
  const keys = requested?.length ? Array.from(new Set(requested)) : available;
  const { dictionary } = await getRequestDictionary();
  const fieldLabels = dictionary.fields as Record<string, string>;
  const columns = keys.map(key => ({ key, label: module === "employees" ? employeeLabels[key] : fieldLabels[key] ?? resource.fields.find(field => field.name === key)?.label ?? key }));
  const rows = allRecords.map(record => Object.fromEntries(keys.map(key => [key, valueOf(record[key], key)])));
  const title = module === "employees" ? "سجل الموظفين" : String((dictionary.nav as Record<string, string>)[module] ?? resource.title);
  const filename = `${resource.key.replace(/[^a-zA-Z0-9_-]/g, "-")}-${new Date().toISOString().slice(0, 10)}`;
  const headers = { "Cache-Control": "private, no-store", "Content-Disposition": `attachment; filename="${filename}.${format}"` };
  if (format === "csv") {
    const sheet = XLSX.utils.aoa_to_sheet([columns.map(column => column.label), ...rows.map(row => keys.map(key => {
      const value = row[key];
      return typeof value === "string" && /^[=+@\-]/.test(value) ? "'" + value : value;
    }))]);
    return new NextResponse("\uFEFF" + XLSX.utils.sheet_to_csv(sheet), { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" } });
  }
  const buffer = format === "pdf" ? await buildPdfTable(title, columns, rows) : await buildExcelTable(title, columns, rows);
  return new NextResponse(new Uint8Array(buffer), { headers: {
    ...headers, "Content-Type": format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  } });
}
