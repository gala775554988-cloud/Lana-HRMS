import { SelfServiceWorkspace } from "@/components/self-service/workspace";
import { OdooRequestsWorkspace } from "@/components/enterprise/odoo-requests-workspace";
export default async function EmployeeRequests({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (await searchParams).tab === 'odoo' ? <OdooRequestsWorkspace employeeMode /> : <SelfServiceWorkspace />;
}
