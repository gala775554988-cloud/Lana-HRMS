import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOdooIntegrationAccess } from "@/lib/integrations/odoo/sync";
import { encryptSecret } from "@/lib/integrations/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function validBaseUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

async function provider() {
  return prisma.integrationProvider.upsert({
    where: { code: "biotime" },
    update: { name: "ZKBio Time", type: "BIOTIME", authType: "JWT", isActive: true },
    create: { name: "ZKBio Time", code: "biotime", type: "BIOTIME", baseUrl: "", authType: "JWT", isActive: true },
  });
}

export async function GET(request: NextRequest) {
  try {
    await requireOdooIntegrationAccess("read", request);
    const p = await prisma.integrationProvider.findUnique({ where: { code: "biotime" } });
    const connection = p ? await prisma.integrationConnection.findFirst({ where: { providerId: p.id }, orderBy: { updatedAt: "desc" } }) : null;
    return NextResponse.json({
      success: true,
      configured: Boolean(connection?.baseUrl && connection?.username && connection?.secretCipher),
      connection: connection ? {
        id: connection.id,
        name: connection.name,
        baseUrl: connection.baseUrl,
        username: connection.username,
        status: connection.status,
        lastTestAt: connection.lastTestAt,
        lastError: connection.lastError,
      } : null,
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: 403 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireOdooIntegrationAccess("manage", request);
    const body = await request.json().catch(() => ({}));
    const baseUrl = clean(body.baseUrl).replace(/\/$/, "");
    const username = clean(body.username);
    const password = clean(body.password);
    if (!validBaseUrl(baseUrl)) return NextResponse.json({ success: false, message: "أدخل رابط BioTime صحيحًا يبدأ بـ http أو https." }, { status: 400 });
    if (!username) return NextResponse.json({ success: false, message: "اسم المستخدم مطلوب." }, { status: 400 });

    const p = await provider();
    const existing = await prisma.integrationConnection.findFirst({ where: { providerId: p.id }, orderBy: { updatedAt: "desc" } });
    if (!existing && !password) return NextResponse.json({ success: false, message: "كلمة المرور مطلوبة عند إنشاء الاتصال." }, { status: 400 });

    const connection = existing
      ? await prisma.integrationConnection.update({
          where: { id: existing.id },
          data: {
            name: clean(body.name) || "ZKBio Time الرئيسي",
            baseUrl,
            username,
            ...(password ? { secretCipher: encryptSecret(password) } : {}),
            status: "DISCONNECTED",
            lastError: null,
          },
        })
      : await prisma.integrationConnection.create({
          data: {
            providerId: p.id,
            name: clean(body.name) || "ZKBio Time الرئيسي",
            baseUrl,
            username,
            secretCipher: encryptSecret(password),
            status: "DISCONNECTED",
          },
        });

    return NextResponse.json({ success: true, connection: { id: connection.id, baseUrl: connection.baseUrl, username: connection.username, status: connection.status } });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
