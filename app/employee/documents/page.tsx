import { getCurrentEmployee } from "@/lib/employee/data";

export default async function DocumentsPage() {
  const employee = await getCurrentEmployee();
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">المستندات</h1>
      <div className="text-muted-foreground">قريباً - رفع وإدارة المستندات الخاصة بك.</div>
    </div>
  );
}
