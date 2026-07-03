import { NextResponse, type NextRequest } from "next/server";
import { deleteModuleRecord, getModuleRecord, updateModuleRecord } from "@/lib/hrms/actions";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ module: string; id: string }> }) {
  const { module: resourceKey, id } = await params;
  const result = await getModuleRecord(resourceKey, id);
  return NextResponse.json(result);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ module: string; id: string }> }) {
  const { module: resourceKey, id } = await params;
  const values = await request.json() as Record<string, unknown>;
  const result = await updateModuleRecord({ resourceKey, id, values });
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ module: string; id: string }> }) {
  const { module: resourceKey, id } = await params;
  const result = await deleteModuleRecord(resourceKey, id);
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
