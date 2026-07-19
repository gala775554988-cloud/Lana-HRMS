import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateAuthenticationOptions } from "@simplewebauthn/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { identifier } = body || {};

    let user: any = null;
    if (identifier) {
      user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: { equals: identifier, mode: "insensitive" } },
            { username: { equals: identifier, mode: "insensitive" } },
            { employeeProfile: { employeeNumber: identifier } }
          ]
        },
        include: { biometricCredentials: true }
      });
    }

    const hostname = req.headers.get("host")?.split(":")[0] || "localhost";
    const rpID = hostname === "localhost" || hostname === "127.0.0.1" ? hostname : hostname.replace(/^www\./, "");

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: user?.biometricCredentials?.map((cred: any) => ({
        id: cred.credentialID,
        type: "public-key",
        transports: cred.transports || ["internal"]
      })) || [],
      userVerification: "preferred"
    });

    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { currentChallenge: options.challenge }
      });
    }

    return NextResponse.json({ success: true, options, userId: user?.id || null });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: "فشل إنشاء خيارات التحقق البيومتري",
      error: error?.message || String(error)
    }, { status: 500 });
  }
}
