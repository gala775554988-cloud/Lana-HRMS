import { prisma } from "@/lib/prisma";

/** Legacy UUIDs are no longer an authentication factor or an account lock.
 * Login ownership is verified by email OTP inside Credentials.authorize.
 * Keep this adapter for attendance/notification callers during migration.
 */
export async function verifyOrBindEmployeeDevice(
  _employeeId: string,
  _deviceId?: string | null,
  _platform = "mobile"
): Promise<{ allowed: boolean; boundDeviceId?: string; reason: string; isNewBinding?: boolean }> {
  return { allowed: true, reason: "SESSION_IDENTITY_VERIFIED" };
}

export function invalidateMultiDeviceOverrideCache(): void {}

/** Explicit administrative cleanup of legacy records; never needed for login. */
export async function unbindEmployeeDevice(employeeId: string): Promise<boolean> {
  try {
    await prisma.employeeMobileDevice.deleteMany({ where: { employeeId } });
    return true;
  } catch {
    return false;
  }
}
