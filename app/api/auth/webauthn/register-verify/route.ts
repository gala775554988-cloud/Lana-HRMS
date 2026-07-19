import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { verifyRegistrationResponse } from "@simplewebauthn/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || !body.response) {
      return NextResponse.json({ success: false, message: "Invalid WebAuthn response data" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    });

    if (!user || !user.currentChallenge) {
      return NextResponse.json({ success: false, message: "Challenge expired or not found. يرجى المحاولة مرة أخرى" }, { status: 400 });
    }

    const hostname = req.headers.get("host")?.split(":")[0] || "localhost";
    const rpID = hostname === "localhost" || hostname === "127.0.0.1" ? hostname : hostname.replace(/^www\./, "");
    const origin = req.headers.get("origin") || `https://${hostname}`;

    const verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: user.currentChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ success: false, message: "فشل التحقق من صحة المفتاح البيومتري للجهاز" }, { status: 400 });
    }

    const { credentialID, credentialPublicKey, counter, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

    // Check if hardware credential ID is already registered
    const existingCred = await prisma.biometricCredential.findUnique({
      where: { credentialID }
    }).catch(() => null);

    if (existingCred) {
      await prisma.biometricCredential.update({
        where: { id: existingCred.id },
        data: {
          publicKey: Buffer.from(credentialPublicKey),
          counter: BigInt(counter),
          lastUsedAt: new Date(),
          deviceName: body.deviceName || "Hardware Biometric Device"
        }
      });
    } else {
      await prisma.biometricCredential.create({
        data: {
          userId: user.id,
          credentialID,
          publicKey: Buffer.from(credentialPublicKey),
          counter: BigInt(counter),
          deviceType: credentialDeviceType || "platform",
          backedUp: credentialBackedUp || false,
          transports: body.response?.response?.transports || ["internal"],
          deviceName: body.deviceName || "Hardware Biometric Device",
          lastUsedAt: new Date()
        }
      });
    }

    // Clear challenge & authorize hardware continuity across PWA and browser
    await prisma.user.update({
      where: { id: user.id },
      data: { currentChallenge: null, canUseMultipleDevices: true }
    });

    // Also auto-bind employee mobile/hardware device table if employee profile exists
    const employee = await prisma.employee.findFirst({ where: { userId: user.id } }).catch(() => null);
    if (employee) {
      const deviceId = `webauthn-hw-${credentialID.slice(0, 16)}`;
      await prisma.employeeMobileDevice.upsert({
        where: { deviceId },
        update: {
          employeeId: employee.id,
          isBlocked: false,
          verifiedAt: new Date(),
          lastActiveAt: new Date(),
          deviceName: body.deviceName || "PWA / Biometric Hardware Key"
        },
        create: {
          employeeId: employee.id,
          deviceId,
          deviceHash: credentialID,
          deviceName: body.deviceName || "PWA / Biometric Hardware Key",
          platform: "WebAuthn Biometric PWA",
          isBlocked: false,
          verifiedAt: new Date(),
          lastActiveAt: new Date()
        }
      }).catch(() => null);
    }

    return NextResponse.json({
      success: true,
      message: "✓ تم ربط حسابك ببصمة الجهاز والمفتاح المشفر المشفر بنجاح! يمكنك الآن الدخول من المتصفح أو تطبيق سطح المكتب دون قفل أو حظر."
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: "حدث خطأ أثناء حفظ البصمة البيومترية",
      error: error?.message || String(error)
    }, { status: 500 });
  }
}
