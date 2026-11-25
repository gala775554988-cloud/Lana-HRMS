import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { createHash } from "node:crypto";
import { z } from "zod";
import { analyzeEmployeeImport, createEmployeeImportTemplateBuffer, importEmployees, parseEmployeeImportFile, type BulkImportOptions } from "@/lib/enterprise/bulk-employee-import";

function canManageEmployees(session: any) {
  if (!session?.user) return false;
  const roles = (session.user.roles as string[]) ?? [];
  const permissions = (session.user.permissions as string[]) ?? [];
  return roles.includes("SUPER_ADMIN"); // Whole-organization import requires global authority.
}

function parseOptions(value: FormDataEntryValue | null): BulkImportOptions {
  if (typeof value !== "string" || !value) return {};
  try {
    return z.object({autoCreateReferences:z.boolean().optional(),duplicateStrategy:z.enum(["skip","update","ignore"]).optional()}).strict().parse(JSON.parse(value));
  } catch {
    throw Error("خيارات الاستيراد غير صالحة");
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

  try {
  if(Number(request.headers.get("content-length")??0)>3500000)return NextResponse.json({success:false,message:"حجم الملف يتجاوز الحد"},{status:413});
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ success: false, message: "File is required" }, { status: 400 });
  if (!/\.(xlsx|csv)$/i.test(file.name)) return NextResponse.json({ success: false, message: "Only .xlsx and .csv files are supported" }, { status: 400 });

  const mode = String(formData.get("mode") ?? "analyze");
  const options = parseOptions(formData.get("options"));
  if(!["analyze","import"].includes(mode)||file.size<1||file.size>3000000)return NextResponse.json({success:false,message:"ملف أو إجراء غير صالح"},{status:400});
  const bytes=Buffer.from(await file.arrayBuffer());
  const rows = parseEmployeeImportFile(bytes,file.name);
  const analysis=await analyzeEmployeeImport(rows,options);
  const preview=createHash("sha256").update(bytes).update(JSON.stringify([session!.user.id,options,analysis])).digest("hex");

  if (mode === "import") {
    if(formData.get("preview")!==preview||analysis.errors.length)return NextResponse.json({success:false,message:"أعد معاينة الملف وصحح الأخطاء قبل الاستيراد",analysis},{status:409});
    const result = await importEmployees(rows, options, session!.user.id);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  }

  return NextResponse.json({ success: true, analysis,preview },{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){return NextResponse.json({success:false,message:error instanceof Error&&!("code" in error)?error.message:"تعذر الاستيراد؛ أعد المعاينة"},{status:409});}
}
