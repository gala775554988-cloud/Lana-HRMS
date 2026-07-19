import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.response) {
      return NextResponse.json({ success: false, message: "Invalid WebAuthn response data" }, { status: 400 });
    }

    const credentialID = body.response.id || body.response.rawId;
    if (!credentialID) {
      return NextResponse.json({ success: false, message: "Missing credential ID" }, { status: 400 });
    }

    const credential = await prisma.biometricCredential.findUnique({
      where: { credentialID },
      include: { user: true }
    });

    if (!credential || !credential.user || !credential.user.currentChallenge) {
      return NextResponse.json({ success: false, message: "المفتاح البيومتري غير مسجل في النظام أو التحدي منتهي الصلاحية" }, { status: 404 });
    }

    const hostname = req.headers.get("host")?.split(":")[0] || "localhost";
    const rpID = hostname === "localhost" || hostname === "127.0.0.1" ? hostname : hostname.replace(/^www\./, "");
    const origin = req.headers.get("origin") || `https://${hostname}`;

    const verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: credential.user.currentChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: credential.credentialID,
        credentialPublicKey: new Uint8Array(credential.publicKey),
        counter: Number(credential.counter)
      }
    });

    if (!verification.verified || !verification.authenticationInfo) {
      return NextResponse.json({ success: false, message: "فشل التحقق من توقيع الجهاز البيومتري" }, { status: 401 });
    }

    const { newCounter } = verification.authenticationInfo;

    await prisma.biometricCredential.update({
      where: { id: credential.id },
      data: {
        counter: BigInt(newCounter),
        lastUsedAt: new Date()
      }
    });

    await prisma.user.update({
      where: { id: credential.user.id },
      data: { currentChallenge: null, lastLoginAt: new Date(), canUseMultipleDevices: true }
    });

    // Also touch hardware device binding table
    const employee = await prisma.employee.findFirst({ where: { userId: credential.user.id } }).catch(() => null);
    if (employee) {
      const deviceId = `webauthn-hw-${credentialID.slice(0, 16)}`;
      await prisma.employeeMobileDevice.upsert({
        where: { deviceId },
        update: {
          employeeId: employee.id,
          isBlocked: false,
          lastActiveAt: new Date(),
          deviceName: body.deviceName || "Verified PWA / Hardware Device"
        },
        create: {
          employeeId: employee.id,
          deviceId,
          deviceHash: credentialID,
          deviceName: body.deviceName || "Verified PWA / Hardware Device",
          platform: "WebAuthn Biometric PWA",
          isBlocked: false,
          verifiedAt: new Date(),
          lastActiveAt: new Date()
        }
      }).catch(() => null);
    }

    return NextResponse.json({
      success: true,
      message: "✓ تم التحقق البيومتري من الجهاز بنجاح! يتم الآن تسجيل الدخول...",
      user: {
        id: credential.user.id,
        email: credential.user.email,
        name: credential.user.name,
        username: credential.user.username
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: "حدث خطأ تقني أثناء التحقق البيومتري من المفتاح",
      error: error?.message || String(error)
    }, { status: 500 });
  }
}
