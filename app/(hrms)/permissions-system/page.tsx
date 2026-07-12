import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PermissionsAdmin } from "./admin-client";

export default async function PermissionsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const roles = (session.user as any).roles || [];
  if (!roles.includes("SUPER_ADMIN")) redirect("/employees");

  const [allRoles, allUsers, branches, departments, approvalChains] = await Promise.all([
    prisma.role.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ select: { id: true, name: true, email: true, username: true }, orderBy: { name: "asc" }, take: 200 }),
    prisma.branch.findMany({ select: { id: true, name: true }, where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ select: { id: true, name: true }, where: { isActive: true }, orderBy: { name: "asc" } }),
    Promise.all(["leave","overtime","loan","expense"].map(async (m) => ({
      module: m,
      chain: await prisma.hrApprovalChain.findMany({ where: { module: m, isActive: true }, orderBy: { level: "asc" } }),
    }))),
  ]);

  return <PermissionsAdmin
    allRoles={JSON.parse(JSON.stringify(allRoles))}
    allUsers={JSON.parse(JSON.stringify(allUsers))}
    branches={JSON.parse(JSON.stringify(branches))}
    departments={JSON.parse(JSON.stringify(departments))}
    approvalChains={JSON.parse(JSON.stringify(approvalChains))}
  />;
}
