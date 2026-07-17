import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Check Device Binding Status Endpoint (`GET /api/enterprise/check-device`)
 * --------------------------------------------------------------------------
 * Checks if a targeted employee (`employeeId`) currently has a registered mobile device
 * bound to their card (`EmployeeMobileDevice`) in Neon PostgreSQL.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const employeeId = request.nextUrl.searchParams.get("employeeId") || undefined;
    if (!employeeId) {
      return NextResponse.json({ success: false, message: "employeeId parameter required" }, { status: 400 });
    }

    const device = await prisma.employeeMobileDevice.findFirst({
      where: { employeeId }
    });

    return NextResponse.json({
      success: true,
      isBound: Boolean(device),
      device: device
        ? {
            id: device.id,
            deviceId: device.deviceId,
            platform: device.platform,
            lastSeenAt: device.lastSeenAt.toISOString(),
            createdAt: device.createdAt.toISOString()
          }
        : null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
