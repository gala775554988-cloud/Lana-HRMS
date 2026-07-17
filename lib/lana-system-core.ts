import { prisma } from "@/lib/prisma";
import { clearMemoryCache } from "@/lib/cache/memory-cache";

/**
 * Lana System Core Utilities (`lib/lana-system-core.ts`)
 * -------------------------------------------------------
 * Re-exports the safe, build-stable Prisma singleton and provides core database
 * automation and device management handlers used across enterprise APIs.
 */
export { prisma };

/**
 * Core Device Unbind Handler (`unbindDeviceLogic`)
 * Safely purges mobile device bindings (`EmployeeMobileDevice`) from Neon PostgreSQL
 * and clears any local memory/LRU device binding cache entries (`device_binding:${employeeId}`).
 */
export async function unbindDeviceLogic(employeeId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanEmpId = String(employeeId || "").trim();
    if (!cleanEmpId) {
      return { success: false, error: "employeeId is required" };
    }

    // Clear in-memory LRU cache
    clearMemoryCache(`device_binding:${cleanEmpId}`);

    // Execute direct safe delete in Neon database
    await prisma.employeeMobileDevice.deleteMany({
      where: { employeeId: cleanEmpId }
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database error during device unbind";
    console.error("[LanaSystemCore] Error inside unbindDeviceLogic:", error);
    return { success: false, error: message };
  }
}
