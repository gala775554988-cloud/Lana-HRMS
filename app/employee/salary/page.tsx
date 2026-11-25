import { EmployeeFinance } from "@/components/payroll/employee-finance";
import { EmployeeLedger } from "@/components/payroll/employee-ledger";
export default function SalaryPage() {
  return <div className="min-w-0 space-y-6"><EmployeeFinance /><EmployeeLedger /></div>;
}
