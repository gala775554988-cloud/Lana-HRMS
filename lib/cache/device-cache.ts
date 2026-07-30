import { prisma } from "@/lib/prisma";
import { clearMemoryCache } from "@/lib/cache/memory-cache";
import { writeAuditLog } from "@/lib/audit";

const DEVICE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type DeviceVerificationResult = {
  allowed: boolean;
  boundDeviceId?: string;
  reason: string;
  isNewBinding?: boolean;
};

// A small process-local cache is only an optimization. The database remains
// authoritative, particularly when a second device is being registered.
const deviceMemoryMap = new Map<string, { deviceIds: string[]; expiresAt: number }>();

function getCachedDevices(key: string): string[] | null {
  const entry = deviceMemoryMap.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    deviceMemoryMap.delete(key);
    return null;
  }
  return entry.deviceIds;
}

function setCachedDevices(key: string, deviceIds: string[]) {
  deviceMemoryMap.set(key, {
    deviceIds: Array.from(new Set(deviceIds)),
    expiresAt: Date.now() + DEVICE_CACHE_TTL_MS,
  });
}

function deleteCachedDevices(key: string) {
  deviceMemoryMap.delete(key);
  clearMemoryCache(key);
}

/** Audit a blocked attempt without exposing device identifiers to clients. */
export async function notifyAdminOnUnauthorizedDeviceAttempt(
  employeeId: string,
  attemptedDeviceId: string,
  boundDeviceId?: string
): Promise<void> {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, firstName: true, lastName: true, employeeNumber: true, userId: true },
    });
    if (!employee) return;

    await writeAuditLog({
      actorUserId: employee.userId || "SYSTEM",
      action: "auth:device_binding_blocked",
      entity: "EmployeeMobileDevice",
      entityId: employeeId,
      metadata: {
        employeeId,
        attemptedDeviceId,
        boundDeviceId,
        reason: "Device belongs to another employee",
      },
    }).catch(() => {});

    await prisma.notification.create({
      data: {
        title: "تنبيه أمني: جهاز مرتبط بحساب آخر",
        body: `حاول الموظف ${employee.firstName} ${employee.lastName} (رقم وظيفي: ${employee.employeeNumber}) استخدام جهاز مرتبط بحساب موظف آخر.`,
        type: "WARNING",
        userId: null,
      },
    }).catch(() => {});
  } catch {
    // Auditing/notification must never change the authentication decision.
  }
}

/**
 * Every employee may use any number of devices. A device remains globally
 * unique, so one browser/device UUID cannot be silently attached to a second
 * employee account.
 */
export async function verifyOrBindEmployeeDevice(
  employeeId: string,
  deviceId?: string | null,
  platform = "mobile"
): Promise<DeviceVerificationResult> {
  const cleanDeviceId = (deviceId || "").trim();
  if (
    !cleanDeviceId ||
    cleanDeviceId === "unknown" ||
    cleanDeviceId === "server-side" ||
    cleanDeviceId === "mobile-session-fallback"
  ) {
    return { allowed: true, reason: "WEB_OR_UNBOUND_SESSION" };
  }

  const cacheKey = `device_binding:${employeeId}`;
  if (getCachedDevices(cacheKey)?.includes(cleanDeviceId)) {
    return { allowed: true, boundDeviceId: cleanDeviceId, reason: "DEVICE_VERIFIED_CACHE_HIT" };
  }

  try {
    const boundDevices = await prisma.employeeMobileDevice.findMany({
      where: { employeeId },
      orderBy: { createdAt: "asc" },
    });
    const deviceIds = boundDevices.map((device) => device.deviceId);
    const matchedDevice = boundDevices.find((device) => device.deviceId === cleanDeviceId);
    if (matchedDevice) {
      prisma.employeeMobileDevice.update({ where: { id: matchedDevice.id }, data: { lastSeenAt: new Date(), platform } }).catch(() => {});
      setCachedDevices(cacheKey, deviceIds);
      return { allowed: true, boundDeviceId: cleanDeviceId, reason: "DEVICE_VERIFIED_SQL_HIT" };
    }

    try {
      await prisma.employeeMobileDevice.create({ data: { employeeId, deviceId: cleanDeviceId, platform } });
      setCachedDevices(cacheKey, [...deviceIds, cleanDeviceId]);
      return { allowed: true, boundDeviceId: cleanDeviceId, reason: "DEVICE_AUTO_BOUND_SUCCESS", isNewBinding: true };
    } catch {
      // A simultaneous login may have inserted this UUID first. Re-read once;
      // if it belongs to another account, reject only that unsafe reuse.
      const existing = await prisma.employeeMobileDevice.findUnique({ where: { deviceId: cleanDeviceId } });
      if (existing?.employeeId === employeeId) {
        return { allowed: true, boundDeviceId: cleanDeviceId, reason: "DEVICE_CONCURRENT_BIND_SUCCESS" };
      }
      notifyAdminOnUnauthorizedDeviceAttempt(employeeId, cleanDeviceId, existing?.deviceId).catch(() => {});
      return { allowed: false, boundDeviceId: existing?.deviceId, reason: "هذا الجهاز مسجل لحساب موظف آخر. يرجى فك ارتباطه أولاً." };
    }
  } catch {
    return { allowed: true, reason: "DEVICE_CHECK_FAILSAFE_ALLOWED" };
  }
}

/** Kept for callers that invalidate device permission/binding state. */
export function invalidateMultiDeviceOverrideCache(): void {
  deviceMemoryMap.clear();
}

/** Remove all registered devices for an employee, allowing two fresh binds. */
export async function unbindEmployeeDevice(employeeId: string): Promise<boolean> {
  const cacheKey = `device_binding:${employeeId}`;
  deleteCachedDevices(cacheKey);
  try {
    await prisma.employeeMobileDevice.deleteMany({ where: { employeeId } });
    return true;
  } catch {
    return false;
  }
}
