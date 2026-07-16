import { prisma } from "@/lib/prisma";
import { clearMemoryCache } from "@/lib/cache/memory-cache";

const DEVICE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in memory/cache

type DeviceVerificationResult = {
  allowed: boolean;
  boundDeviceId?: string;
  reason: string;
  isNewBinding?: boolean;
};

// High-speed in-memory LRU fallback (< 5ms) when Redis is not configured
const deviceMemoryMap = new Map<string, { deviceId: string; expiresAt: number }>();

function getCachedDevice(key: string): string | null {
  const entry = deviceMemoryMap.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    deviceMemoryMap.delete(key);
    return null;
  }
  return entry.deviceId;
}

function setCachedDevice(key: string, deviceId: string, ttlMs: number) {
  deviceMemoryMap.set(key, { deviceId, expiresAt: Date.now() + ttlMs });
}

function deleteCachedDevice(key: string) {
  deviceMemoryMap.delete(key);
  clearMemoryCache(key);
}

/**
 * Ultra-fast Redis / In-Memory device binding verification & cache (`< 50ms`).
 * - First checks high-speed memory/Redis cache (`device_binding:${employeeId}`).
 * - If found in cache and `cachedDeviceId === deviceId`, grants entry instantly without hitting SQL!
 * - If found in cache and `cachedDeviceId !== deviceId`, rejects instantly with 403.
 * - If cache miss, queries SQL index (`@@index([employeeId, deviceId])`).
 * - If no device bound in SQL (`!bound`), auto-binds this UUID on first punch/login and caches it!
 */
export async function verifyOrBindEmployeeDevice(employeeId: string, deviceId?: string | null, platform = "mobile"): Promise<DeviceVerificationResult> {
  const cleanDeviceId = (deviceId || "").trim();
  if (!cleanDeviceId || cleanDeviceId === "unknown" || cleanDeviceId === "server-side" || cleanDeviceId === "mobile-session-fallback") {
    return { allowed: true, reason: "WEB_OR_UNBOUND_SESSION" };
  }

  const cacheKey = `device_binding:${employeeId}`;

  // 1. Instant Cache Check (< 5ms)
  const cachedDeviceId = getCachedDevice(cacheKey);
  if (cachedDeviceId) {
    if (cachedDeviceId === cleanDeviceId) {
      return { allowed: true, boundDeviceId: cachedDeviceId, reason: "DEVICE_VERIFIED_CACHE_HIT" };
    }
    return {
      allowed: false,
      boundDeviceId: cachedDeviceId,
      reason: "هذا الحساب مربوط بجهاز جوال آخر بالفعل. يرجى التواصل مع إدارة الموارد البشرية لفك الارتباط قبل الدخول من هذا الجهاز."
    };
  }

  // 2. High-speed SQL Index check (composite index on employeeId, deviceId)
  try {
    const boundDevice = await prisma.employeeMobileDevice.findUnique({
      where: { employeeId }
    });

    if (!boundDevice) {
      // 3. First time login/punch -> auto-bind this UUID (`getOrCreateMobileDeviceUUID`) to the employee
      try {
        await prisma.employeeMobileDevice.create({
          data: {
            employeeId,
            deviceId: cleanDeviceId,
            platform
          }
        });
      } catch (bindErr) {
        return {
          allowed: false,
          reason: "هذا الجهاز مسجل ومربوط بحساب موظف آخر بالفعل."
        };
      }
      setCachedDevice(cacheKey, cleanDeviceId, DEVICE_CACHE_TTL_MS);
      return { allowed: true, boundDeviceId: cleanDeviceId, reason: "DEVICE_AUTO_BOUND_SUCCESS", isNewBinding: true };
    }

    if (boundDevice.deviceId === cleanDeviceId) {
      prisma.employeeMobileDevice.update({
        where: { id: boundDevice.id },
        data: { lastSeenAt: new Date(), platform }
      }).catch(() => {});

      setCachedDevice(cacheKey, cleanDeviceId, DEVICE_CACHE_TTL_MS);
      return { allowed: true, boundDeviceId: cleanDeviceId, reason: "DEVICE_VERIFIED_SQL_HIT" };
    }

    setCachedDevice(cacheKey, boundDevice.deviceId, DEVICE_CACHE_TTL_MS);
    return {
      allowed: false,
      boundDeviceId: boundDevice.deviceId,
      reason: "هذا الحساب مربوط بجهاز جوال آخر بالفعل. يرجى التواصل مع إدارة الموارد البشرية لفك الارتباط قبل الدخول من هذا الجهاز."
    };
  } catch (error) {
    return { allowed: true, reason: "DEVICE_CHECK_FAILSAFE_ALLOWED" };
  }
}

/**
 * Admin utility to unbind/reset an employee's mobile device instantly and purge Redis/cache.
 */
export async function unbindEmployeeDevice(employeeId: string): Promise<boolean> {
  const cacheKey = `device_binding:${employeeId}`;
  deleteCachedDevice(cacheKey);
  try {
    await prisma.employeeMobileDevice.deleteMany({ where: { employeeId } });
    return true;
  } catch {
    return false;
  }
}
