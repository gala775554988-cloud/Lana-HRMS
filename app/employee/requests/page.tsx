import { getCurrentEmployee } from "@/lib/employee/data";
import { RequestsCenter } from "@/components/employee/RequestsCenter";

export default async function RequestsPage() {
  const employee = await getCurrentEmployee();
  if (!employee) return <div>خطأ</div>;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">مركز الطلبات</h1>
      <RequestsCenter employeeId={employee.id} />
    </div>
  );
}
