import { NextRequest, NextResponse } from "next/server";
import { OdooClient } from "@/lib/integrations/odoo/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * On-demand stream download for large Odoo attachments (`ir.attachment`) or database embedded base64 files.
 * Prevents 512 MB PostgreSQL database quota exhaustion while ensuring instant bulletproof delivery.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const { id: employeeId, attachmentId } = await params;
    const attId = parseInt(attachmentId, 10);
    const isNumericId = !isNaN(attId) && attId > 0;

    // 1. Check if document exists in our database by odooAttachmentId or id
    const doc = await prisma.employeeDocument.findFirst({
      where: isNumericId
        ? { OR: [{ employeeId, odooAttachmentId: attId }, { id: attachmentId }] }
        : { OR: [{ id: attachmentId }, { employeeId, fileUrl: { contains: attachmentId } }] }
    }).catch(() => null);

    const fileName = doc?.fileName || doc?.name || `document-${attachmentId}.pdf`;
    const mimeType = doc?.mimeType || (fileName.endsWith(".pdf") ? "application/pdf" : fileName.endsWith(".png") ? "image/png" : fileName.endsWith(".jpg") || fileName.endsWith(".jpeg") ? "image/jpeg" : "application/octet-stream");

    // 2. If doc has embedded base64 data URI in fileUrl, return it directly immediately (0ms latency!)
    if (doc?.fileUrl && doc.fileUrl.startsWith("data:")) {
      const commaIndex = doc.fileUrl.indexOf(",");
      if (commaIndex !== -1) {
        const base64Data = doc.fileUrl.slice(commaIndex + 1);
        const buffer = Buffer.from(base64Data, "base64");
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            "Content-Type": mimeType,
            "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
            "Cache-Control": "public, max-age=3600"
          }
        });
      }
    }

    // 3. If doc has direct external URL (e.g. Supabase or CDN or /uploads/...), fetch/redirect
    if (doc?.fileUrl && (doc.fileUrl.startsWith("http://") || doc.fileUrl.startsWith("https://"))) {
      return NextResponse.redirect(doc.fileUrl);
    }

    // 4. Otherwise, fetch on-demand directly from Odoo ir.attachment
    if (!isNumericId) {
      return new NextResponse(`
        <html dir="rtl"><body style="font-family:sans-serif;text-align:center;padding:50px;background:#f8fafc;color:#334155;">
          <h2 style="color:#e11d48;">⚠️ تعذر العثور على الملف المطلوب في النظام</h2>
          <p>المستند غير متاح برمجياً (معرف غير صالح لجلب الملف من أودو).</p>
        </body></html>
      `, { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    const client = OdooClient.fromEnv();
    await client.connect();

    const [attachment] = await client.read<{ datas?: string; mimetype?: string; name?: string }>(
      "ir.attachment",
      [attId],
      ["datas", "mimetype", "name"]
    ).catch(() => [null]);

    if (!attachment?.datas) {
      return new NextResponse(`
        <html dir="rtl"><body style="font-family:sans-serif;text-align:center;padding:50px;background:#f8fafc;color:#334155;">
          <h2 style="color:#e11d48;">⚠️ الملف غير متوفر حالياً في خوادم أودو</h2>
          <p>تم البحث عن المستند رقم (${attId}) ولكن محتوى الملف غير موجود أو تم حذفه من المصدر.</p>
        </body></html>
      `, { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    const buffer = Buffer.from(attachment.datas, "base64");
    const finalMimeType = attachment.mimetype || mimeType;
    const finalFileName = attachment.name || fileName;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": finalMimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(finalFileName)}"`,
        "Cache-Control": "public, max-age=3600"
      }
    });
  } catch (error: any) {
    return new NextResponse(`
      <html dir="rtl"><body style="font-family:sans-serif;text-align:center;padding:50px;background:#f8fafc;color:#334155;">
        <h2 style="color:#e11d48;">⚠️ حدث خطأ تقني أثناء جلب الملف من أودو</h2>
        <p style="color:#64748b;font-size:13px;">${error?.message || String(error)}</p>
      </body></html>
    `, { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}
