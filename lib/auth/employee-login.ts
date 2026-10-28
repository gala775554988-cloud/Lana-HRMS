import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { timingSafeEqual } from "node:crypto";

/** Only ordinary employee accounts use the ID suffix; privileged accounts retain their password. */
export async function employeeLoginProfile(userId: string) {
  const [employee, roles] = await Promise.all([
    prisma.employee.findFirst({ where: { userId }, select: { nationalId: true, email: true } }),
    prisma.userRole.findMany({ where: { userId }, select: { role: { select: { name: true } } } }),
  ]);
  return employee && roles.every(({ role }) => role.name === "EMPLOYEE") ? employee : null;
}

export function matchesIdentitySuffix(password: string, nationalId: string) {
  if (!/^\d{4}$/.test(password) || !/^\d{4,}$/.test(nationalId)) return false;
  return timingSafeEqual(Buffer.from(password), Buffer.from(nationalId.slice(-4)));
}

export async function checkLoginPassword(user: { id: string; passwordHash: string | null; employeePasswordMode?: string }, password: string) {
  const employee = await employeeLoginProfile(user.id);
  const valid = employee && user.employeePasswordMode !== "CUSTOM"
    ? matchesIdentitySuffix(password, employee.nationalId)
    : Boolean(user.passwordHash && await verifyPassword(password, user.passwordHash));
  return { valid, employee };
}
