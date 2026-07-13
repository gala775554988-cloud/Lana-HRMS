import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roles = (session.user.roles as string[]) || [];
  if (!roles.includes("SUPER_ADMIN") && !roles.includes("HR_MANAGER")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const prompt = String(body.prompt || "");
  let output: unknown = { mode: "rules", text: prompt };
  if (process.env.OPENAI_API_KEY) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4o-mini", messages: [{ role: "user", content: prompt }], temperature: 0.2 }) }).catch(() => null);
    output = response?.ok ? await response.json() : output;
  }
  const record = await prisma.aICopilotRecord.create({ data: { type: String(body.type || "ai-chat"), prompt, context: body.context || {}, output: output as object, status: "DONE", model: process.env.OPENAI_MODEL || null } });
  return NextResponse.json({ success: true, record });
}
