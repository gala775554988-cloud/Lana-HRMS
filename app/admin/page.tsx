import { redirectToRoleGatedDashboard } from "@/lib/auth/role-guard";

export default async function AdminPage() {
  await redirectToRoleGatedDashboard();
}
