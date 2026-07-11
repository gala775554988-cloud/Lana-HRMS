import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = await request.json();
    if (body.action === "folder") {
      const employeeId = String(body.employeeId || "");
      const folderName = String(body.folderName || "").trim();
      if (!employeeId || !folderName) return NextResponse.json({ success: false, message: "employeeId/folderName required" }, { status: 400 });
      const key = `employee.documents.folders.${employeeId}`;
      const next = Array.from(new Set([...(await folders(employeeId)), folderName]));
      await prisma.appSetting.upsert({ where: { key }, update: { value: next }, create: { key, value: next, description: "Employee document folders" } });
      return NextResponse.json({ success: true, folders: next });
    }
  }

  const form = await request.formData();
  const employeeId = String(form.get("employeeId") || "");
  if (!employeeId) return NextResponse.json({ success: false, message: "employeeId required" }, { status: 400 });
  const files = form.getAll("files").filter((item): item is File => item instanceof File);
  if (!files.length) return NextResponse.json({ success: false, message: "No files" }, { status: 400 });

  const documents = [];
  for (const file of files) {
    if (!allowedExtensions.has(ext(file.name))) return NextResponse.json({ success: false, message: `Unsupported file: ${file.name}` }, { status: 400 });
    const bytes = Buffer.from(await file.arrayBuffer());
    const fileUrl = `data:${file.type || "application/octet-stream"};base64,${bytes.toString("base64")}`;
    documents.push(await prisma.employeeDocument.create({
      data: { employeeId, type: typeOf(file.name, file.type || ""), name: file.name.replace(/\.[^.]+$/, "") || file.name, fileUrl, fileName: file.name, mimeType: file.type || "application/octet-stream", sizeBytes: file.size, status: "PENDING" },
      select: { id: true, name: true, type: true, fileUrl: true, fileName: true, mimeType: true, sizeBytes: true, status: true, uploadedAt: true },
    }));
  }
  return NextResponse.json({ success: true, documents });
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ success: false, message: "id required" }, { status: 400 });
  await prisma.employeeDocument.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
