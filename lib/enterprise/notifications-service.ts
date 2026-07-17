import { prisma } from "@/lib/prisma";

export interface PushNotificationOptions {
  clickAction?: string;
  icon?: string;
  badge?: string;
  data?: Record<string, string>;
}

/**
 * Enterprise Push Notification Service (`sendPushNotification`)
 * --------------------------------------------------------------
 * 1. Queries `EmployeeMobileDevice` in Neon PostgreSQL using `userId` or `employeeId`
 *    to retrieve the active `fcmToken`.
 * 2. Dispatches push notification via Firebase Cloud Messaging (`FCM_SERVER_KEY`).
 * 3. Uses our official circular maskable icon (`/icons/icon-192.png`) and default click action (`/requests`).
 */
export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  options: PushNotificationOptions = {}
): Promise<boolean> {
  try {
    // 1. Resolve employee and device
    const employee = await prisma.employee.findFirst({
      where: {
        OR: [{ userId: userId }, { id: userId }]
      },
      select: { id: true, userId: true }
    });

    if (!employee) return false;

    const userDevice = await prisma.employeeMobileDevice.findFirst({
      where: { employeeId: employee.id }
    });

    const fcmToken = userDevice?.fcmToken || process.env.FCM_DEFAULT_TEST_TOKEN;
    if (!fcmToken) {
      return false;
    }

    const serverKey = process.env.FCM_SERVER_KEY || process.env.FIREBASE_CLOUD_MESSAGING_KEY;
    if (!serverKey) {
      console.log(`[PushNotificationService] FCM_SERVER_KEY not set. Simulated push to device ${userDevice?.deviceId || fcmToken}: "${title}" -> "${body}"`);
      return true;
    }

    // 2. Dispatch push via FCM REST API
    const response = await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        "Authorization": `key=${serverKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        to: fcmToken,
        notification: {
          title: title,
          body: body,
          icon: options.icon || "/icons/icon-192.png", // الأيقونة الدائرية التي اعتمدناها
          badge: options.badge || "/favicon.png",
          click_action: options.clickAction || "https://lana-hrms-lanahr.vercel.app/requests"
        },
        data: {
          ...options.data,
          title,
          body,
          url: options.clickAction || "/requests"
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error(`[PushNotificationService] FCM server responded with HTTP ${response.status}: ${errText}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[PushNotificationService] Error sending push notification:", error);
    return false;
  }
}

/**
 * Register or update mobile device push token (`fcmToken`) in Neon database.
 */
export async function registerDevicePushToken({
  userId,
  employeeId,
  deviceId,
  fcmToken,
  platform = "mobile"
}: {
  userId?: string;
  employeeId?: string;
  deviceId: string;
  fcmToken: string;
  platform?: string;
}): Promise<boolean> {
  try {
    let empId = employeeId;
    if (!empId && userId) {
      const emp = await prisma.employee.findFirst({ where: { userId }, select: { id: true } });
      empId = emp?.id;
    }
    if (!empId || !deviceId || !fcmToken) return false;

    await prisma.employeeMobileDevice.upsert({
      where: { employeeId: empId },
      update: {
        deviceId: deviceId.trim(),
        fcmToken: fcmToken.trim(),
        platform,
        lastSeenAt: new Date()
      },
      create: {
        employeeId: empId,
        deviceId: deviceId.trim(),
        fcmToken: fcmToken.trim(),
        platform
      }
    });

    return true;
  } catch (err) {
    console.error("[PushNotificationService] Error registering device token:", err);
    return false;
  }
}
