import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAccessEmployeeId, getAccessProfile } from "@/lib/enterprise/hierarchy";
import { isEnterpriseResourceAllowed } from "@/lib/enterprise/resource-access";
import { hasPermission } from "@/lib/rbac";
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
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const roles = session.user.roles ?? [];
    const profile = await getAccessProfile(session.user.id, roles);
    const permissions = session.user.permissions ?? [];
    const canReadDocuments = isEnterpriseResourceAllowed(roles, "documents") &&
      (roles.includes("HR_MANAGER") || hasPermission(permissions, { action: "read", resource: "documents" }, roles) ||
        permissions.includes("manage:documents"));
    if (profile.employee?.id !== employeeId &&
      (!canReadDocuments || !await canAccessEmployeeId(employeeId, profile))) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const numericId = Number(attachmentId);
    const isNumericId = /^\d+$/.test(attachmentId) && Number.isSafeInteger(numericId) && numericId > 0 && numericId <= 2147483647;
    const doc = await prisma.employeeDocument.findFirst({
      where: { employeeId, OR: [
        { id: attachmentId },
        ...(isNumericId ? [{ odooAttachmentId: numericId }] : []),
      ] },
    });
    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    const fileName = doc.fileName || doc.name || `document-${attachmentId}.pdf`;
    const mimeType = doc.mimeType || (fileName.endsWith(".pdf") ? "application/pdf" : fileName.endsWith(".png") ? "image/png" : fileName.endsWith(".jpg") || fileName.endsWith(".jpeg") ? "image/jpeg" : "application/octet-stream");

    // 2. If doc has embedded base64 data URI in fileUrl, return it directly immediately (0ms latency!)
    if (doc.fileUrl && doc.fileUrl.startsWith("data:")) {
      const commaIndex = doc.fileUrl.indexOf(",");
      if (commaIndex !== -1) {
        const base64Data = doc.fileUrl.slice(commaIndex + 1);
        const buffer = Buffer.from(base64Data, "base64");
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            "Content-Type": mimeType,
            "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "sandbox"
          }
        });
      }
    }

    // 3. If doc has direct external URL (e.g. Supabase or CDN or /uploads/...), fetch/redirect
    if (doc.fileUrl && (doc.fileUrl.startsWith("http://") || doc.fileUrl.startsWith("https://"))) {
      return NextResponse.redirect(doc.fileUrl, { headers: { "Cache-Control": "private, no-store" } });
    }

    // 4. Otherwise, fetch on-demand directly from Odoo ir.attachment
    const attId = doc.odooAttachmentId;
    if (!attId) {
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
        "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "sandbox"
      }
    });
  } catch {
    return new NextResponse(`
      <html dir="rtl"><body style="font-family:sans-serif;text-align:center;padding:50px;background:#f8fafc;color:#334155;">
        <h2 style="color:#e11d48;">⚠️ حدث خطأ تقني أثناء جلب الملف من أودو</h2>
        <p>حاول مرة أخرى لاحقاً.</p>
      </body></html>
    `, { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}
