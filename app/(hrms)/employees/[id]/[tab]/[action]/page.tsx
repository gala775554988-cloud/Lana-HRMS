import EmployeeProfilePage from "../../page";

export default async function EmployeeTabActionPage({ params }: { params: Promise<{ id: string; tab: string; action: string }> }) {
  const { id } = await params;
  return EmployeeProfilePage({ params: Promise.resolve({ id }) });
}
