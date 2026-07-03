import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ message: "File is required" }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ message: "File must be 10MB or smaller" }, { status: 400 });
  const bytes = Buffer.from(await file.arrayBuffer());
  const extension = path.extname(file.name).slice(0, 16);
  const fileName = randomUUID() + extension;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, fileName), bytes);
  return NextResponse.json({ url: "/uploads/" + fileName, fileName: file.name, size: file.size, type: file.type });
}
