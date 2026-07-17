import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Direct Neon PostgreSQL Backend Service - Get & Delete Specific Conversation
 * Enforces Row Level Security (RLS) so users can only read or delete their own chat history.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const userId = session.user.id;
    const roles: string[] = (session.user as any).roles || [];
    const isSuperAdmin = roles.includes("SUPER_ADMIN") || roles.includes("HR_MANAGER");

    const conversation = await prisma.aIAssistantConversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" }
        }
      }
    });

    if (!conversation) {
      return NextResponse.json({ success: false, message: "Conversation not found in Neon database" }, { status: 404 });
    }

    // Row Level Security check
    if (conversation.userId !== userId && !isSuperAdmin) {
      return NextResponse.json({ success: false, message: "Forbidden: You do not have access to this conversation history" }, { status: 403 });
    }

    const formattedMessages = conversation.messages.map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content || "",
      toolCalls: m.toolCalls,
      output: m.output,
      createdAt: m.createdAt.toISOString()
    }));

    return NextResponse.json({
      success: true,
      conversation: {
        id: conversation.id,
        title: conversation.title,
        status: conversation.status,
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString()
      },
      messages: formattedMessages
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const userId = session.user.id;
    const roles: string[] = (session.user as any).roles || [];
    const isSuperAdmin = roles.includes("SUPER_ADMIN") || roles.includes("HR_MANAGER");

    const conversation = await prisma.aIAssistantConversation.findUnique({
      where: { id },
      select: { userId: true }
    });

    if (!conversation) {
      return NextResponse.json({ success: false, message: "Conversation not found" }, { status: 404 });
    }

    if (conversation.userId !== userId && !isSuperAdmin) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    await prisma.aIAssistantConversation.delete({
      where: { id }
    });

    return NextResponse.json({ success: true, message: "تم حذف المحادثة بنجاح من قاعدة بيانات Neon" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
