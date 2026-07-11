import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const allowedExtensions = new Set([
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".zip", ".rar",
  ".png", ".jpg", ".jpeg", ".webp", ".mp4", ".mov", ".txt", ".csv", ".xml"
]);

function canManageDocuments(session: any) {
  const roles = session?.user?.roles as string[] | undefined;
  const permissions = session?.user?.permissions as string[] | undefined;
  return Boolean(
    roles?.includes("SUPER_ADMIN") ||
    roles?.includes("HR_MANAGER") ||
    permissions?.includes("*:*") ||
    permissions?.includes("manage:documents") ||
    permissions?.includes("upload:documents") ||
    permissions?.includes("upload-documents:employees")
  );
}

function extensionOf(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : "";
}

function documentType(fileName: string, mimeType: string) {
  const ext = extensionOf(fileName).replace(/^\./, "").toUpperCase();
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (mimeType.startsWith("video/")) return "VIDEO";
  return ext || "DOCUMENT";
}

async function readFolders(employeeId: string) {
  const key = `employee.documents.folders.${employeeId}`;
  const setting = await prisma.appSetting.findUnique({ where: { key }, select: { value: true } }).catch(() => null);
  return Array.isArray(setting?.value) ? setting.value : [];
}

async function saveFolder(employeeId: string, name: string) {
  const key = `employee.documents.folders.${employeeId}`;
  const folders = await readFolders(employeeId);
  const next = Array.from(new Set([...folders.map(String), name.trim()].filter(Boolean)));
  await prisma.appSetting.upsert({
    where: { key },
    update: { value: next },
    create: { key, value: next, description: "Employee document folders" },
  });
  return next;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ employeeId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const { employeeId } = await params;
  const [documents, folders] = await Promise.all([
    prisma.employeeDocument.findMany({
      where: { employeeId },
      select: { id: true, name: true, type: true, fileUrl: true, fileName: true, mimeType: true, sizeBytes: true, status: true, expiresAt: true, uploadedAt: true, updatedAt: true },
      orderBy: { uploadedAt: "desc" },
      take: 200,
    }),
    readFolders(employeeId),
  ]);
  return NextResponse.json({ success: true, documents, folders });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ employeeId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!canManageDocuments(session)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  const { employeeId } = await params;
  const formData = await request.formData();
  const action = String(formData.get("action") ?? "upload");

  if (action === "folder") {
    const folderName = String(formData.get("folderName") ?? "").trim();
    if (!folderName) return NextResponse.json({ success: false, message: "Folder name is required" }, { status: 400 });
    const folders = await saveFolder(employeeId, folderName);
    return NextResponse.json({ success: true, folders });
  }

  const files = formData.getAll("files").filter((item): item is File => item instanceof File);
  const single = formData.get("file");
  if (single instanceof File) files.push(single);
  if (!files.length) return NextResponse.json({ success: false, message: "No files received" }, { status: 400 });

  const created = [];
  for (const file of files) {
    const ext = extensionOf(file.name);
    if (!allowedExtensions.has(ext)) {
      return NextResponse.json({ success: false, message: `Unsupported file type: ${file.name}` }, { status: 400 });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const dataUrl = `data:${file.type || "application/octet-stream"};base64,${bytes.toString("base64")}`;
    const document = await prisma.employeeDocument.create({
      data: {
        employeeId,
        type: documentType(file.name, file.type || ""),
        name: file.name.replace(/\.[^.]+$/, "") || file.name,
        fileUrl: dataUrl,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        status: "PENDING",
      },
      select: { id: true, name: true, type: true, fileName: true, mimeType: true, sizeBytes: true, status: true, uploadedAt: true },
    });
    created.push(document);
  }

  await prisma.auditLog.create({
    data: {
      actorUserId: session.user.id,
      action: "documents:upload",
      entity: "employee",
      entityId: employeeId,
      metadata: { count: created.length, files: created.map((doc) => doc.fileName) },
    },
  }).catch(() => undefined);

  return NextResponse.json({ success: true, documents: created });
}
