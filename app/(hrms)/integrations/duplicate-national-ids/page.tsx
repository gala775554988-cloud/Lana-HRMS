import { prisma } from "@/lib/prisma";
import { IntegrationShell, DataCard } from "@/components/integrations/integration-shell";
import DuplicateReportClient from "@/components/integrations/duplicate-national-ids-client";

export const dynamic = "force-dynamic";

export default async function DuplicateNationalIdsPage() {
  const connections = await prisma.integrationConnection.findMany().catch(() => []);

  return (
    <IntegrationShell title="تقرير أرقام الهوية المكررة" description="فحص جميع موظفي Odoo (يشمل غير النشطين active_test=false) والبحث عن أرقام الهوية المكررة - لا يتم حذف أو تعديل أي بيانات">
      <DataCard title="الاتصالات المتاحة">
        <div className="text-sm text-muted-foreground">
          عدد اتصالات Odoo: {connections.length} - سيتم استخدام الاتصال الافتراضي من البيئة إذا لم تحدد اتصالاً
        </div>
      </DataCard>
      <DuplicateReportClient />
    </IntegrationShell>
  );
}
