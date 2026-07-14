import { HospitalsClient } from "@/components/hrms/hospitals-client";

export default function HospitalsPage() {
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">المؤسسة</p>
        <h1 className="text-3xl font-semibold tracking-tight">المستشفيات</h1>
        <p className="mt-2 text-muted-foreground">إدارة المستشفيات وربطها بالإدارة والفرع وعرض عدد الموظفين.</p>
      </div>
      <HospitalsClient />
    </section>
  );
}
