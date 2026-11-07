import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessEmployeeId, getAccessProfile } from "@/lib/enterprise/hierarchy";
import { isEnterpriseResourceAllowed } from "@/lib/enterprise/resource-access";
import { hasPermission } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Employee Portal is view-only for documents (employees never upload/delete
// their own official records -- those are Odoo-sourced/HR-managed). Only
// callers holding the same manage:documents grant already required to reach
// the admin employee-profile document manager may mutate through this route.
function canManageDocuments(session: Session) {
  const roles = session.user.roles ?? [];
  return isEnterpriseResourceAllowed(roles, "documents") &&
    hasPermission(session.user.permissions, { action: "manage", resource: "documents" }, roles);
}

async function canManageEmployeeDocuments(session: Session, employeeId: string) {
  const profile = await getAccessProfile(session.user.id, session.user.roles ?? []);
  return canAccessEmployeeId(employeeId, profile);
}

const allowedExtensions = new Set([".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".zip", ".rar", ".png", ".jpg", ".jpeg", ".webp", ".mp4", ".mov", ".txt", ".csv", ".xml"]);

function ext(name: string) { const i = name.lastIndexOf("."); return i >= 0 ? name.slice(i).toLowerCase() : ""; }
function typeOf(name: string, mime: string) { if (mime.startsWith("image/")) return "IMAGE"; if (mime.startsWith("video/")) return "VIDEO"; return ext(name).replace(/^\./, "").toUpperCase() || "DOCUMENT"; }

async function folders(employeeId: string) {
  const key = `employee.documents.folders.${employeeId}`;
  const row = await prisma.appSetting.findUnique({ where: { key }, select: { value: true } }).catch(() => null);
  return Array.isArray(row?.value) ? row.value.map(String) : [];
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!canManageDocuments(session)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = await request.json();
    if (body.action === "folder") {
      const employeeId = String(body.employeeId || "");
      const folderName = String(body.folderName || "").trim();
      if (!employeeId || !folderName) return NextResponse.json({ success: false, message: "employeeId/folderName required" }, { status: 400 });
      if (!await canManageEmployeeDocuments(session, employeeId)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
      const key = `employee.documents.folders.${employeeId}`;
      const next = Array.from(new Set([...(await folders(employeeId)), folderName]));
      await prisma.appSetting.upsert({ where: { key }, update: { value: next }, create: { key, value: next, description: "Employee document folders" } });
      return NextResponse.json({ success: true, folders: next });
    }
    return NextResponse.json({ success: false, message: "Unsupported action" }, { status: 400 });
  }

  const form = await request.formData();
  const employeeId = String(form.get("employeeId") || "");
  if (!employeeId) return NextResponse.json({ success: false, message: "employeeId required" }, { status: 400 });
  if (!await canManageEmployeeDocuments(session, employeeId)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  const files = form.getAll("files").filter((item): item is File => item instanceof File);
  if (!files.length) return NextResponse.json({ success: false, message: "No files" }, { status: 400 });

  const unsupported = files.find(file => !allowedExtensions.has(ext(file.name)));
  if (unsupported) return NextResponse.json({ success: false, message: `Unsupported file: ${unsupported.name}` }, { status: 400 });

  const rows = await Promise.all(files.map(async file => {
    const mimeType = file.type || "application/octet-stream";
    const bytes = Buffer.from(await file.arrayBuffer());
    return {
      employeeId, type: typeOf(file.name, mimeType), name: file.name.replace(/\.[^.]+$/, "") || file.name,
      fileUrl: `data:${mimeType};base64,${bytes.toString("base64")}`,
      fileName: file.name, mimeType, sizeBytes: file.size, status: "PENDING" as const,
    };
  }));
  const documents = await prisma.$transaction(rows.map(data => prisma.employeeDocument.create({
    data,
    select: { id: true, name: true, type: true, fileUrl: true, fileName: true, mimeType: true, sizeBytes: true, status: true, uploadedAt: true },
  })));
  return NextResponse.json({ success: true, documents });
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!canManageDocuments(session)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ success: false, message: "id required" }, { status: 400 });
  const document = await prisma.employeeDocument.findUnique({ where: { id }, select: { employeeId: true } });
  if (!document || !await canManageEmployeeDocuments(session, document.employeeId)) {
    return NextResponse.json({ success: false, message: "Document not found" }, { status: 404 });
  }
  const result = await prisma.employeeDocument.deleteMany({ where: { id, employeeId: document.employeeId } });
  if (!result.count) return NextResponse.json({ success: false, message: "Document not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
