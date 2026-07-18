import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";

const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tiff", ".tif", ".svg", ".heic", ".heif", ".avif"]);
const allowedMimePrefixes = ["image/"];
// Non-image document uploads (insurance policies, etc.) -- same allowlist as
// the employee-documents endpoint, stored as-is (no image optimization).
const allowedDocumentExtensions = new Set([".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".png", ".jpg", ".jpeg"]);

type OptimizedImage = {
  buffer: Buffer;
  extension: string;
  type: string;
};

async function optimizeImage(bytes: Buffer, fileName: string, mimeType: string): Promise<OptimizedImage> {
  const extension = path.extname(fileName).toLowerCase();
  const isSvg = extension === ".svg" || mimeType === "image/svg+xml";
  if (isSvg) return { buffer: bytes, extension: ".svg", type: "image/svg+xml" };

  try {
    const sharp = (await import("sharp")).default;
    const buffer = await sharp(bytes, { failOn: "none" })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84, effort: 4 })
      .toBuffer();
    return { buffer, extension: ".webp", type: "image/webp" };
  } catch {
    return { buffer: bytes, extension: extension || ".jpg", type: mimeType || "application/octet-stream" };
  }
}


async function uploadToSupabaseStorage(buffer: Buffer, fileName: string, contentType: string, folder = "profile-photos") {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const bucket = process.env.SUPABASE_EMPLOYEE_BUCKET || 'employee-files';
  if (!supabaseUrl || !key) return null;
  const objectPath = `${folder}/${new Date().toISOString().slice(0,10)}/${fileName}`;
  const endpoint = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/${bucket}/${objectPath}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': contentType, 'x-upsert': 'true' },
    body: new Uint8Array(buffer),
  }).catch(() => null);
  if (!response?.ok) return null;
  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${objectPath}`;
}

function dataUrlFromImage(image: OptimizedImage) {
  return `data:${image.type};base64,${image.buffer.toString("base64")}`;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, message: "File is required" }, { status: 400 });
    }

    const extension = path.extname(file.name).toLowerCase();
    const kind = String(formData.get("kind") || "image");

    if (kind === "document") {
      if (!allowedDocumentExtensions.has(extension)) {
        return NextResponse.json({ success: false, message: "Unsupported document file" }, { status: 400 });
      }
      const rawBytes = Buffer.from(await file.arrayBuffer());
      const fileName = randomUUID() + extension;
      const contentType = file.type || "application/octet-stream";

      const supabaseUrl = await uploadToSupabaseStorage(rawBytes, fileName, contentType, "documents/insurance");
      if (supabaseUrl) {
        return NextResponse.json({ success: true, url: supabaseUrl, fileName: file.name, size: rawBytes.length, type: contentType, storage: "supabase-storage" });
      }
      try {
        const uploadDir = path.join(process.cwd(), "public", "uploads");
        await mkdir(uploadDir, { recursive: true });
        await writeFile(path.join(uploadDir, fileName), rawBytes);
        return NextResponse.json({ success: true, url: "/uploads/" + fileName, fileName: file.name, size: rawBytes.length, type: contentType, storage: "public-uploads" });
      } catch {
        return NextResponse.json({ success: true, url: `data:${contentType};base64,${rawBytes.toString("base64")}`, fileName: file.name, size: rawBytes.length, type: contentType, storage: "inline-data-url" });
      }
    }

    const looksLikeImage = allowedMimePrefixes.some((prefix) => file.type.startsWith(prefix)) || allowedExtensions.has(extension);
    if (!looksLikeImage) {
      return NextResponse.json({ success: false, message: "Unsupported image file" }, { status: 400 });
    }

    const rawBytes = Buffer.from(await file.arrayBuffer());
    const optimized = await optimizeImage(rawBytes, file.name, file.type);
    const fileName = randomUUID() + optimized.extension;
    const uploadDir = path.join(process.cwd(), "public", "uploads");

    const supabaseUrl = await uploadToSupabaseStorage(optimized.buffer, fileName, optimized.type);
    if (supabaseUrl) {
      return NextResponse.json({
        success: true,
        url: supabaseUrl,
        fileName: file.name,
        size: optimized.buffer.length,
        originalSize: file.size,
        type: optimized.type,
        storage: "supabase-storage"
      });
    }

    try {
      await mkdir(uploadDir, { recursive: true });
      await writeFile(path.join(uploadDir, fileName), optimized.buffer);
      return NextResponse.json({
        success: true,
        url: "/uploads/" + fileName,
        fileName: file.name,
        size: optimized.buffer.length,
        originalSize: file.size,
        type: optimized.type,
        storage: "public-uploads"
      });
    } catch (fileSystemError) {
      const url = dataUrlFromImage(optimized);
      return NextResponse.json({
        success: true,
        url,
        fileName: file.name,
        size: optimized.buffer.length,
        originalSize: file.size,
        type: optimized.type,
        storage: "inline-data-url"
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json(
      {
        success: false,
        message
      },
      {
        status: 500
      }
    );
  }
}
