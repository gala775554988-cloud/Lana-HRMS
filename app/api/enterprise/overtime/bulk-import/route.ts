import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { canManageOvertime } from "@/lib/enterprise/overtime";
import { analyzeOvertimeImport, createOvertimeImportTemplateBuffer, importOvertimeRows, parseOvertimeImportFile } from "@/lib/enterprise/bulk-overtime-import";

export async function GET() {
  const session = await auth();
  if (!canManageOvertime(session)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: session?.user ? 403 : 401 });
  const buffer = createOvertimeImportTemplateBuffer();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=lana-hrms-overtime-template.xlsx"
    }
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!canManageOvertime(session)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ success: false, message: "File is required" }, { status: 400 });
  if (!/\.(xlsx|csv)$/i.test(file.name)) return NextResponse.json({ success: false, message: "Only .xlsx and .csv files are supported" }, { status: 400 });

  const mode = String(formData.get("mode") ?? "analyze");
  const roles = (session.user.roles as string[]) ?? [];
  const rows = parseOvertimeImportFile(Buffer.from(await file.arrayBuffer())).slice(0, 2000);

  if (mode === "import") {
    const result = await importOvertimeRows(rows, session.user.id, roles);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  }

  const analysis = await analyzeOvertimeImport(rows, session.user.id, roles);
  return NextResponse.json({ success: true, analysis });
}
