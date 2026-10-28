import { prisma } from "@/lib/prisma";
import { verifyOrBindEmployeeDevice, unbindEmployeeDevice } from "@/lib/cache/device-cache";

/** Compatibility adapter: session authentication replaces UUID account locking. */
export async function verifyDeviceBinding(userId: string, currentDeviceId: string, platform = "mobile-pwa"): Promise<boolean> {
  const cleanId = (currentDeviceId || "").trim();
  if (!cleanId || cleanId === "unknown" || cleanId === "server-side" || cleanId === "mobile-session-fallback") {
    return true;
  }

  // Resolve employee ID from user ID
  let targetEmpId = userId;
  const emp = await prisma.employee.findFirst({
    where: { OR: [{ id: userId }, { userId: userId }] },
    select: { id: true }
  });
  if (emp) targetEmpId = emp.id;

  const result = await verifyOrBindEmployeeDevice(targetEmpId, cleanId, platform);
  if (!result.allowed) {
    throw new Error("DEVICE_LOCKED: تم تسجيل دخولك من جهاز آخر. يرجى مراجعة الموارد البشرية لإعادة ضبط الجهاز.");
  }

  return true;
}

/**
 * Reset / unbind device for a specific user or employee (`resetEmployeeDevice`).
 */
export async function resetEmployeeDevice(userIdOrEmployeeId: string): Promise<boolean> {
  let targetEmpId = userIdOrEmployeeId;
  const emp = await prisma.employee.findFirst({
    where: { OR: [{ id: userIdOrEmployeeId }, { userId: userIdOrEmployeeId }] },
    select: { id: true }
  });
  if (emp) targetEmpId = emp.id;

  return unbindEmployeeDevice(targetEmpId);
}
