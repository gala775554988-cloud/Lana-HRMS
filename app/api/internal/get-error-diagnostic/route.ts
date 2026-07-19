import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import "@/lib/error-interceptor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns exact raw server diagnostic details (`message`, `stack`) for any given Server Digest or recent crash.
 * Called by client error boundaries (`error.tsx`) when Next.js conceals server exceptions in production.
 */
export async function GET(request: NextRequest) {
  try {
    const digest = request.nextUrl.searchParams.get("digest") || "";
    
    // Check in-memory store first
    if (digest && globalThis.__LANA_SERVER_ERRORS__?.has(digest)) {
      const stored = globalThis.__LANA_SERVER_ERRORS__.get(digest);
      return NextResponse.json({ success: true, digest, ...stored, source: "MemoryStore" });
    }

    // Check recent diagnostic logs in database
    if (digest) {
      const log = await prisma.integrationLog.findFirst({
        where: {
          action: "SERVER_CRASH_DIAGNOSTIC",
          message: { contains: digest }
        },
        orderBy: { createdAt: "desc" }
      }).catch(() => null);

      if (log && log.response) {
        return NextResponse.json({ success: true, digest, ...(log.response as any), source: "DatabaseStore" });
      }
    }

    // Return latest server error if specific digest not matched immediately
    const latestLog = await prisma.integrationLog.findFirst({
      where: { action: "SERVER_CRASH_DIAGNOSTIC" },
      orderBy: { createdAt: "desc" }
    }).catch(() => null);

    if (latestLog && latestLog.response) {
      return NextResponse.json({
        success: true,
        digest: (latestLog.response as any).digest || "LATEST",
        message: (latestLog.response as any).message,
        stack: (latestLog.response as any).stack,
        timestamp: (latestLog.response as any).timestamp,
        source: "LatestDatabaseFallback"
      });
    }

    return NextResponse.json({
      success: false,
      message: `No detailed diagnostic found yet for digest '${digest || "N/A"}'. Check if error occurred before interceptor initialized.`
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || String(err) }, { status: 500 });
  }
}
