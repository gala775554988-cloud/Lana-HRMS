import { NextRequest, NextResponse } from "next/server";
import { OdooClient } from "@/lib/integrations/odoo/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * On-demand stream download for large Odoo attachments (`ir.attachment`).
 * Prevents 512 MB PostgreSQL database quota exhaustion on Neon Hobby plan.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const { id: employeeId, attachmentId } = await params;
    const attId = parseInt(attachmentId, 10);
    if (isNaN(attId) || attId <= 0) {
      return NextResponse.json({ success: false, message: "Invalid attachment ID" }, { status: 400 });
    }

    const doc = await prisma.employeeDocument.findFirst({
      where: { employeeId, odooAttachmentId: attId }
    }).catch(() => null);

    const client = OdooClient.fromEnv();
    await client.connect();

    const [attachment] = await client.read<{ datas?: string; mimetype?: string; name?: string }>(
      "ir.attachment",
      [attId],
      ["datas", "mimetype", "name"]
    ).catch(() => [null]);

    if (!attachment?.datas) {
      return NextResponse.json({ success: false, message: "Attachment file content not found in Odoo" }, { status: 404 });
    }

    const buffer = Buffer.from(attachment.datas, "base64");
    const mimeType = attachment.mimetype || doc?.mimeType || "application/pdf";
    const fileName = attachment.name || doc?.fileName || `document-${attId}.pdf`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
        "Cache-Control": "public, max-age=3600"
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Error fetching document from Odoo", details: error?.message || String(error) }, { status: 500 });
  }
}
