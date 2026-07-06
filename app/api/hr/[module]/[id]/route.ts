import { NextResponse, type NextRequest } from "next/server";
import { deleteModuleRecord, getModuleRecord, updateModuleRecord } from "@/lib/hrms/actions";
import { formatApiError } from "@/lib/errors";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ module: string; id: string }> }) {
  try {
    const { module: resourceKey, id } = await params;
    const result = await getModuleRecord(resourceKey, id);
    if (!result) {
      return NextResponse.json(
        { success: false, error: { id: `NF-${Date.now().toString(36)}`, category: "api", name: "Not Found", message: "السجل غير موجود", cause: "لم يتم العثور على السجل المطلوب", suggestion: "تحقق من صحة المعرف وحاول مرة أخرى", statusCode: 404 } },
        { status: 404 }
      );
    }
    return NextResponse.json(result);
  } catch (error: any) {
    const apiError = formatApiError(error, { location: "api/hr/[module]/[id]", operation: "GET" });
    const status = error?.message === "Unauthorized" ? 401 : error?.message === "Forbidden" ? 403 : 500;
    return NextResponse.json(apiError, { status });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ module: string; id: string }> }) {
  try {
    const { module: resourceKey, id } = await params;
    const values = await request.json() as Record<string, unknown>;
    const result = await updateModuleRecord({ resourceKey, id, values });
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: any) {
    const apiError = formatApiError(error, { location: "api/hr/[module]/[id]", operation: "PATCH" });
    const status = error?.message === "Unauthorized" ? 401 : error?.message === "Forbidden" ? 403 : 500;
    return NextResponse.json(apiError, { status });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ module: string; id: string }> }) {
  try {
    const { module: resourceKey, id } = await params;
    const result = await deleteModuleRecord(resourceKey, id);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: any) {
    const apiError = formatApiError(error, { location: "api/hr/[module]/[id]", operation: "DELETE" });
    const status = error?.message === "Unauthorized" ? 401 : error?.message === "Forbidden" ? 403 : 500;
    return NextResponse.json(apiError, { status });
  }
}
