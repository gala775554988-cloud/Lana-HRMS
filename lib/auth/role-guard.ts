import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { resolveRoleDashboard } from "@/config/auth";

/**
 * Shared by the app/admin, app/hr, app/manager landing pages: require a
 * session, optionally restrict to a set of roles (falling back to the
 * role-resolved dashboard if not allowed), then redirect to targetPath
 * (or the role-resolved dashboard when no targetPath is given).
 */
export async function redirectToRoleGatedDashboard(options?: { allowedRoles?: string[]; targetPath?: string }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const roles = (session.user.roles as string[]) || [];
  if (options?.allowedRoles && !roles.some((role) => options.allowedRoles!.includes(role))) {
    redirect(resolveRoleDashboard(roles));
  }
  redirect(options?.targetPath ?? resolveRoleDashboard(roles));
}
