import { getCurrentEmployee, getRequestSummary } from "@/lib/employee/data";
import { RequestsPage } from "@/components/employee/RequestsPage";

export default async function Requests() {
  const employee = await getCurrentEmployee();
  const summary = employee ? await getRequestSummary(employee.id) : { pending: 0, approved: 0, rejected: 0 };
  return <RequestsPage employee={employee} summary={summary} />;
}
