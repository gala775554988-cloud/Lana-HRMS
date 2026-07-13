import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasAnyRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasAnyRole(session, ["SUPER_ADMIN", "HR_MANAGER"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const text = String(body.text || "");
  const entities = { emails: text.match(/[\w.-]+@[\w.-]+/g) || [], phones: text.match(/\+?\d[\d\s-]{7,}\d/g) || [], language: /[\u0600-\u06FF]/.test(text) ? "ar" : "en" };
  const record = await prisma.documentAIRecord.create({ data: { type: String(body.type || "ocr"), fileUrl: String(body.fileUrl || "/api/uploads"), language: entities.language, status: "PARSED", extractedText: text, entities, confidence: text ? 0.85 : 0 } });
  return NextResponse.json({ success: true, record });
}
