import { NextResponse, type NextRequest } from "next/server";
import { createModuleRecord, listModuleRecords } from "@/lib/hrms/actions";

export async function GET(request: NextRequest, { params }: { params: Promise<{ module: string }> }) {
  const { module: resourceKey } = await params;
  const searchParams = request.nextUrl.searchParams;
  const filters: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    if (!["page", "pageSize", "search"].includes(key)) filters[key] = value;
  });
  const result = await listModuleRecords({ resourceKey, page: Number(searchParams.get("page") ?? 1), pageSize: Number(searchParams.get("pageSize") ?? 10), search: searchParams.get("search") ?? "", filters });
  return NextResponse.json(result);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ module: string }> }) {
  const { module: resourceKey } = await params;
  const values = await request.json() as Record<string, unknown>;
  const result = await createModuleRecord({ resourceKey, values });
  return NextResponse.json(result, { status: result.success ? 201 : 400 });
}
