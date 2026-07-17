import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { registerDevicePushToken } from "@/lib/enterprise/notifications-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Enterprise Mobile Push Registration Endpoint (`/api/enterprise/register-device`)
 * -----------------------------------------------------------------------------
 * Receives the Firebase / Web Push token (`fcmToken`) from `TokenRegister` component
 * and securely links it to the logged-in employee's `EmployeeMobileDevice` in Neon PostgreSQL.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token.trim() : undefined;
    const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : request.headers.get("x-device-id") || `web-${session.user.id}`;
    const platform = typeof body.platform === "string" ? body.platform : "mobile-pwa";

    if (!token) {
      return NextResponse.json({ success: false, message: "token is required" }, { status: 400 });
    }

    const success = await registerDevicePushToken({
      userId: session.user.id,
      deviceId,
      fcmToken: token,
      platform
    });

    if (!success) {
      return NextResponse.json({ success: false, message: "تعذر حفظ أو تحديث التوكن في قاعدة بيانات Neon" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "تم تسجيل توكن الإشعارات للجهاز بنجاح في Neon" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
