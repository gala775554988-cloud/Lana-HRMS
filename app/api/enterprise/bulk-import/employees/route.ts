import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/rbac";
import { analyzeEmployeeImport, createEmployeeImportTemplateBuffer, importEmployees, parseEmployeeImportFile, type BulkImportOptions } from "@/lib/enterprise/bulk-employee-import";

function canManageEmployees(session: any) {
  if (!session?.user) return false;
  const roles = (session.user.roles as string[]) ?? [];
  const permissions = (session.user.permissions as string[]) ?? [];
  return roles.includes("SUPER_ADMIN") || hasPermission(permissions, { action: "manage", resource: "employees" });
}

function parseOptions(value: FormDataEntryValue | null): BulkImportOptions {
  if (typeof value !== "string" || !value) return {};
  try {
    return JSON.parse(value) as BulkImportOptions;
  } catch {
    return {};
  }
}

export async function GET() {
  const session = await auth();
  if (!canManageEmployees(session)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: session?.user ? 403 : 401 });
  const buffer = createEmployeeImportTemplateBuffer();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=lana-hrms-employees-template.xlsx"
    }
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!canManageEmployees(session)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: session?.user ? 403 : 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ success: false, message: "File is required" }, { status: 400 });
  if (!/\.(xlsx|csv)$/i.test(file.name)) return NextResponse.json({ success: false, message: "Only .xlsx and .csv files are supported" }, { status: 400 });

  const mode = String(formData.get("mode") ?? "analyze");
  const options = parseOptions(formData.get("options"));
  const rows = parseEmployeeImportFile(Buffer.from(await file.arrayBuffer()), file.name).slice(0, 5000);

  if (mode === "import") {
    const result = await importEmployees(rows, options, session!.user.id);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  }

  const analysis = await analyzeEmployeeImport(rows, options);
  return NextResponse.json({ success: true, analysis });
}
