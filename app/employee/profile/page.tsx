import { getCurrentEmployee } from "@/lib/employee/data";
import { EmployeeProfileForm } from "@/components/employee/EmployeeProfileForm";

export default async function ProfilePage() {
  const employee = await getCurrentEmployee();

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">الملف الشخصي</h1>
      <EmployeeProfileForm employee={employee} />
    </div>
  );
}
