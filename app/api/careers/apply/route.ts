import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { validApplicationToken } from "@/lib/recruitment/application-token";
const schema = z.object({ firstName: z.string().trim().min(2).max(80), lastName: z.string().trim().min(2).max(100), email: z.string().trim().email().max(200), phone: z.string().trim().min(7).max(30), jobOpeningId: z.string().min(1).max(100) });
export async function POST(request: NextRequest) {
  if (Number(request.headers.get("content-length") || 0) > 3000000) return NextResponse.json({ message: "الحد الأقصى للملف ٢ ميجابايت." }, { status: 413 });
  try {
    const form = await request.formData();
    if (!validApplicationToken(String(form.get("token") || "")) || form.get("website")) return NextResponse.json({ message: "حدّث الصفحة ثم حاول مجددًا." }, { status: 400 });
    const parsed = schema.safeParse(Object.fromEntries(form));
    const file = form.get("resume");
    if (!parsed.success || !(file instanceof File) || file.size > 2 * 1024 * 1024 || file.size < 5) return NextResponse.json({ message: "أكمل البيانات وأرفق سيرة ذاتية PDF بحجم لا يتجاوز ٢ ميجابايت." }, { status: 400 });
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.subarray(0, 5).toString() !== "%PDF-") return NextResponse.json({ message: "يرجى رفع ملف PDF صالح." }, { status: 400 });
    const job = await prisma.jobOpening.findFirst({ where: { id: parsed.data.jobOpeningId, status: "OPEN", closedAt: null }, select: { id: true } });
    if (!job) return NextResponse.json({ message: "هذه الوظيفة غير متاحة للتقديم." }, { status: 400 });
    const email = parsed.data.email.toLowerCase();
    // Serialize submissions per email across serverless instances, preventing duplicate races.
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${email}))`;
      const recent = await tx.candidate.count({ where: { email, createdAt: { gte: new Date(Date.now() - 3600000) } } });
      const existing = await tx.candidate.findFirst({ where: { email, jobOpeningId: job.id }, select: { id: true } });
      if (existing) return;
      if (recent >= 3) throw new Error("LIMIT");
      await tx.candidate.create({ data: { ...parsed.data, email, resumeUrl: `data:application/pdf;base64,${bytes.toString("base64")}` } });
    });
    return NextResponse.json({ message: "تم حفظ طلبك وسيرتك الذاتية بنجاح. سيتواصل معك فريق التوظيف عند وجود تحديث." });
  } catch {
    return NextResponse.json({ message: "تعذر حفظ الطلب الآن. انتظر قليلًا ثم حاول مجددًا." }, { status: 503 });
  }
}
