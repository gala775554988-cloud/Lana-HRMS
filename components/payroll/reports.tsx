import Link from 'next/link';
import { FileDown, Printer } from 'lucide-react';

const reports = [
  ['register', 'كشف الرواتب التفصيلي', 'الأساسي والبدلات والاستقطاعات وصافي كل موظف.'],
  ['summary', 'ملخص الرواتب', 'إجماليات المسيرات المحلية حسب الفترة والحالة.'],
  ['by-department', 'الرواتب حسب القسم', 'توزيع تكاليف الرواتب على الأقسام.'],
  ['by-branch', 'الرواتب حسب الفرع', 'توزيع تكاليف الرواتب على الفروع.'],
  ['allowances', 'كشف البدلات', 'البدلات المسجلة وتصنيفاتها ومبالغها.'],
  ['deductions', 'كشف الاستقطاعات', 'بنود الاستقطاع المسجلة وتصنيفاتها.'],
  ['loans', 'كشف السلف والقروض', 'أرصدة السلف والقروض المعتمدة والأقساط.'],
] as const;

export function PayrollReports() {
  return <section className="payroll-workspace min-w-0 space-y-4" aria-label="تقارير الرواتب">
    <header><h2 className="text-lg font-bold">الكشوف والتقارير</h2><p className="mt-2 text-sm text-muted-foreground">تقارير السجلات المحلية. لمعاينة بنود كشوف Odoo الأصلية، افتح القسيمة من كشوف الموظفين. معاينة المستند لا تعني تسجيل الصرف.</p></header>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{reports.map(([key, title, description]) => <article key={key} className="flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex-1"><h3 className="font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p></div>
      <div className="flex flex-wrap gap-2">
        <Link className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm" href={`/print-reports/payroll-register?report=${key}`} target="_blank" rel="noreferrer"><Printer className="h-4 w-4 shrink-0" />معاينة / PDF</Link>
        <a className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm" href={`/api/enterprise/payroll/export?report=${key}`}><FileDown className="h-4 w-4 shrink-0" />تنزيل Excel</a>
      </div>
    </article>)}</div>
    <Link className="inline-flex rounded-xl border px-4 py-2 text-sm font-semibold text-primary" href="/loans">إدارة السلف والقروض والأقساط</Link>
  </section>;
}
