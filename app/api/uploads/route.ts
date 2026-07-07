import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";

const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tiff", ".tif", ".svg", ".heic", ".heif", ".avif"]);
const allowedMimePrefixes = ["image/"];

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
    const looksLikeImage = allowedMimePrefixes.some((prefix) => file.type.startsWith(prefix)) || allowedExtensions.has(extension);
    if (!looksLikeImage) {
      return NextResponse.json({ success: false, message: "Unsupported image file" }, { status: 400 });
    }

    const rawBytes = Buffer.from(await file.arrayBuffer());
    const optimized = await optimizeImage(rawBytes, file.name, file.type);
    const fileName = randomUUID() + optimized.extension;
    const uploadDir = path.join(process.cwd(), "public", "uploads");

    try {
      await mkdir(uploadDir, { recursive: true });
      await writeFile(path.join(uploadDir, fileName), optimized.buffer);
      return NextResponse.json({
        success: true,
        url: "/uploads/" + fileName,
        fileName: file.name,
        size: optimized.buffer.length,
        originalSize: file.size,
        type: optimized.type
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
