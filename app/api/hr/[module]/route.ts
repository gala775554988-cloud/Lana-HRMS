import { NextResponse, type NextRequest } from "next/server";
import { createModuleRecord, listModuleRecords } from "@/lib/hrms/actions";
import { formatApiError } from "@/lib/errors";

export async function GET(request: NextRequest, { params }: { params: Promise<{ module: string }> }) {
  try {
    const { module: resourceKey } = await params;
    const searchParams = request.nextUrl.searchParams;
    const filters: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      if (!["page", "pageSize", "search"].includes(key)) filters[key] = value;
    });
    const result = await listModuleRecords({ resourceKey, page: Number(searchParams.get("page") ?? 1), pageSize: Number(searchParams.get("pageSize") ?? 10), search: searchParams.get("search") ?? "", filters });
    return NextResponse.json(result);
  } catch (error: any) {
    const apiError = formatApiError(error, { location: `api/hr/[module]`, operation: "GET" });
    const status = error?.message === "Unauthorized" ? 401 : error?.message === "Forbidden" ? 403 : 500;
    return NextResponse.json(apiError, { status });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ module: string }> }) {
  try {
    const { module: resourceKey } = await params;
    const values = await request.json() as Record<string, unknown>;
    const result = await createModuleRecord({ resourceKey, values });
    return NextResponse.json(result, { status: result.success ? 201 : 400 });
  } catch (error: any) {
    const apiError = formatApiError(error, { location: `api/hr/[module]`, operation: "POST" });
    const status = error?.message === "Unauthorized" ? 401 : error?.message === "Forbidden" ? 403 : 500;
    return NextResponse.json(apiError, { status });
  }
}
