import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const text = String(body.text || "");
  const entities = { emails: text.match(/[\w.-]+@[\w.-]+/g) || [], phones: text.match(/\+?\d[\d\s-]{7,}\d/g) || [], language: /[\u0600-\u06FF]/.test(text) ? "ar" : "en" };
  const record = await prisma.documentAIRecord.create({ data: { type: String(body.type || "ocr"), fileUrl: String(body.fileUrl || "/api/uploads"), language: entities.language, status: "PARSED", extractedText: text, entities, confidence: text ? 0.85 : 0 } });
  return NextResponse.json({ success: true, record });
}
