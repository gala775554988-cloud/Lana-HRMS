import { prisma } from "@/lib/prisma";
import { clearMemoryCache } from "@/lib/cache/memory-cache";
import { writeAuditLog } from "@/lib/audit";

const DEVICE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_EMPLOYEE_DEVICES = 2;

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
  boundDeviceId?: string,
  maxDevices = MAX_EMPLOYEE_DEVICES
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
        maxDevices,
        reason: "Employee device limit reached",
      },
    }).catch(() => {});

    await prisma.notification.create({
      data: {
        title: "تنبيه أمني: تجاوز الحد المسموح للأجهزة",
        body: `حاول الموظف ${employee.firstName} ${employee.lastName} (رقم وظيفي: ${employee.employeeNumber}) تسجيل الدخول من جهاز إضافي بعد بلوغ حد الجهازين.`,
        type: "WARNING",
        userId: null,
      },
    }).catch(() => {});
  } catch {
    // Auditing/notification must never change the authentication decision.
  }
}

/** The global policy is two devices; an administrator may explicitly reduce
 * one account to a single device through the device-management switch. */
async function getAllowedDeviceLimit(employeeId: string): Promise<number> {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { user: { select: { canUseMultipleDevices: true } } },
    });
    return employee?.user?.canUseMultipleDevices === false ? 1 : MAX_EMPLOYEE_DEVICES;
  } catch {
    return MAX_EMPLOYEE_DEVICES;
  }
}

/**
 * Verify a known device or bind one of up to two devices for every employee.
 * The unique deviceId constraint still prevents one physical/browser device
 * from being silently attached to multiple employee accounts.
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

  const maxDevices = await getAllowedDeviceLimit(employeeId);
  const cacheKey = `device_binding:${employeeId}`;
  const cachedDeviceIds = getCachedDevices(cacheKey);
  if (cachedDeviceIds?.includes(cleanDeviceId)) {
    return {
      allowed: true,
      boundDeviceId: cleanDeviceId,
      reason: "DEVICE_VERIFIED_CACHE_HIT",
    };
  }

  try {
    const boundDevices = await prisma.employeeMobileDevice.findMany({
      where: { employeeId },
      orderBy: { createdAt: "asc" },
      take: maxDevices,
    });
    const deviceIds = boundDevices.map((device) => device.deviceId);

    const matchedDevice = boundDevices.find((device) => device.deviceId === cleanDeviceId);
    if (matchedDevice) {
      prisma.employeeMobileDevice
        .update({
          where: { id: matchedDevice.id },
          data: { lastSeenAt: new Date(), platform },
        })
        .catch(() => {});
      setCachedDevices(cacheKey, deviceIds);
      return {
        allowed: true,
        boundDeviceId: cleanDeviceId,
        reason: "DEVICE_VERIFIED_SQL_HIT",
      };
    }

    if (boundDevices.length >= maxDevices) {
      setCachedDevices(cacheKey, deviceIds);
      notifyAdminOnUnauthorizedDeviceAttempt(employeeId, cleanDeviceId, deviceIds[0], maxDevices).catch(() => {});
      return {
        allowed: false,
        boundDeviceId: deviceIds[0],
        reason: `تم الوصول إلى الحد المسموح وهو ${maxDevices === 1 ? "جهاز واحد" : "جهازان"}. استخدم أحد الأجهزة المرتبطة أو اطلب فك الارتباط من الموارد البشرية.`,
      };
    }

    try {
      await prisma.employeeMobileDevice.create({
        data: { employeeId, deviceId: cleanDeviceId, platform },
      });
      const nextDeviceIds = [...deviceIds, cleanDeviceId];
      setCachedDevices(cacheKey, nextDeviceIds);
      return {
        allowed: true,
        boundDeviceId: cleanDeviceId,
        reason: "DEVICE_AUTO_BOUND_SUCCESS",
        isNewBinding: true,
      };
    } catch {
      // A concurrent login can bind the second slot first. Re-read once so a
      // valid concurrent registration is not reported as a generic failure.
      const currentDevices = await prisma.employeeMobileDevice.findMany({
        where: { employeeId },
        orderBy: { createdAt: "asc" },
        take: maxDevices,
      });
      const currentIds = currentDevices.map((device) => device.deviceId);
      setCachedDevices(cacheKey, currentIds);
      if (currentIds.includes(cleanDeviceId)) {
        return { allowed: true, boundDeviceId: cleanDeviceId, reason: "DEVICE_CONCURRENT_BIND_SUCCESS" };
      }
      notifyAdminOnUnauthorizedDeviceAttempt(employeeId, cleanDeviceId, currentIds[0], maxDevices).catch(() => {});
      return {
        allowed: false,
        boundDeviceId: currentIds[0],
        reason: `تعذر ربط الجهاز الجديد. قد يكون مسجلاً لحساب آخر أو تم بلوغ حد ${maxDevices === 1 ? "الجهاز الواحد" : "الجهازين"}.`,
      };
    }
  } catch {
    // Preserve availability if the device store is temporarily unavailable.
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
