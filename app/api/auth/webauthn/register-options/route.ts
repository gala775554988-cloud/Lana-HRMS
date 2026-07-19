import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateRegistrationOptions } from "@simplewebauthn/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized: يجب تسجيل الدخول لربط بصمة الجهاز" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { biometricCredentials: true }
    });

    if (!user) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
    }

    const hostname = req.headers.get("host")?.split(":")[0] || "localhost";
    const rpID = hostname === "localhost" || hostname === "127.0.0.1" ? hostname : hostname.replace(/^www\./, "");

    const options = await generateRegistrationOptions({
      rpName: "Lana Medical HRMS",
      rpID,
      userID: user.id,
      userName: user.email || user.username || user.name || "Employee",
      userDisplayName: user.name || "Lana Employee",
      attestationType: "none",
      excludeCredentials: user.biometricCredentials.map((cred) => ({
        id: Buffer.from(cred.credentialID, "base64url"),
        type: "public-key" as const
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
        authenticatorAttachment: "platform" // Platform authenticator enforces Touch ID / Face ID / Windows Hello Hardware
      }
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { currentChallenge: options.challenge }
    });

    return NextResponse.json({ success: true, options });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: "فشل إنشاء خيارات تسجيل البصمة البيومترية",
      error: error?.message || String(error)
    }, { status: 500 });
  }
}
