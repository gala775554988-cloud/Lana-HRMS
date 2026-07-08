import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await auth().catch(() => null);
  const body = await request.json();
  const message = String(body.message || "");
  let answer = `Processed: ${message}`;
  if (process.env.OPENAI_API_KEY && message) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4o-mini", messages: [{ role: "user", content: message }], temperature: 0.2 }) }).catch(() => null);
    if (response?.ok) {
      const data = await response.json().catch(() => null) as { choices?: Array<{ message?: { content?: string } }> } | null;
      answer = data?.choices?.[0]?.message?.content || answer;
    }
  }
  try {
    let conversationId = body.conversationId as string | undefined;
    if (!conversationId) {
      const conversation = await prisma.aIAssistantConversation.create({ data: { userId: session?.user?.id, title: message.slice(0, 80) || "AI Conversation", context: body.context || {} } });
      conversationId = conversation.id;
    }
    await prisma.aIAssistantMessage.create({ data: { conversationId, role: "user", content: message, toolCalls: body.toolCalls || [] } });
    const assistantMessage = await prisma.aIAssistantMessage.create({ data: { conversationId, role: "assistant", content: answer, output: { generated: true } } });
    await prisma.aIAssistantMemory.upsert({ where: { id: `${conversationId}-last` }, update: { value: { message, answer } }, create: { id: `${conversationId}-last`, conversationId, userId: session?.user?.id, key: "last_exchange", value: { message, answer } } });
    return NextResponse.json({ success: true, conversationId, message: assistantMessage });
  } catch (error) {
    return NextResponse.json({ success: true, offline: true, answer, message: error instanceof Error ? error.message : String(error) });
  }
}
