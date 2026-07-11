import EmployeeProfilePage from "../page";

export default async function EmployeeEditPage({ params }: { params: Promise<{ id: string }> }) {
  return EmployeeProfilePage({ params });
}
