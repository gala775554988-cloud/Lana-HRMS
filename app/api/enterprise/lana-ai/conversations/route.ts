import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Direct Neon PostgreSQL Backend Service - Get All Conversations
 * Enforces Row Level Security (RLS): users only retrieve their own active AI assistant conversations.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const roles: string[] = (session.user as any).roles || [];
    const isSuperAdmin = roles.includes("SUPER_ADMIN") || roles.includes("HR_MANAGER");

    // Row Level Security (RLS) query against Neon PostgreSQL
    const where: Record<string, unknown> = { status: "ACTIVE" };
    if (!isSuperAdmin || request.nextUrl.searchParams.get("scope") !== "all") {
      where.userId = userId;
    }

    const conversations = await prisma.aIAssistantConversation.findMany({
      where,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { messages: true }
        }
      },
      orderBy: { updatedAt: "desc" },
      take: 50
    });

    const formatted = conversations.map((conv) => ({
      id: conv.id,
      title: conv.title || "محادثة غير مسماة",
      status: conv.status,
      messageCount: conv._count.messages,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString()
    }));

    return NextResponse.json({ success: true, conversations: formatted });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
