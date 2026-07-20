import { SocialInsuranceClient } from "@/components/enterprise/social-insurance-client";

export default function SocialInsurancePage() {
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">الموارد البشرية</p>
        <h1 className="text-3xl font-semibold tracking-tight">التأمينات الاجتماعية</h1>
        <p className="mt-2 text-muted-foreground">تسجيل الموظفين، متابعة الأجور الخاضعة للاشتراك، وسجل الحركات الكامل -- بمزامنة تلقائية مع الرواتب والعقود.</p>
      </div>
      <SocialInsuranceClient />
    </section>
  );
}
