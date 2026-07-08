import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyIncomingWebhook, logIntegration } from "@/lib/integrations/service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ providerId: string }> }) {
  const { providerId } = await params;
  const payload = await request.text();
  const signature = request.headers.get("x-lana-signature") || request.headers.get("x-odoo-signature");
  const verified = await verifyIncomingWebhook(providerId, payload, signature);
  await logIntegration({ providerId, level: verified ? "INFO" : "WARN", action: "WEBHOOK_RECEIVED", message: verified ? "Webhook signature verified" : "Webhook signature rejected", request: { payload } });
  if (!verified) return NextResponse.json({ success: false, message: "Invalid signature" }, { status: 401 });
  await prisma.integrationQueue.create({ data: { providerId, operation: "WEBHOOK", entity: "webhook", payload: JSON.parse(payload || "{}") } });
  return NextResponse.json({ success: true });
}
