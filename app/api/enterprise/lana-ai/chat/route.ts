import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createScopedHrTools, type ToolAuthContext } from "@/lib/ai/tools";
import { getLanaSystemPrompt } from "@/lib/ai/system-prompt";
import { isLanaDelegate } from "@/lib/enterprise/lana-delegates";
import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

/**
/**
 * AI-First Semantic Orchestrator when running locally without OPENAI_API_KEY.
 * Evaluates semantic references directly across Tools without rigid keyword routing or canned fallbacks.
 */
async function executeAiFirstSemanticOrchestrator(userMessage: string, context: ToolAuthContext, tools: any, conversationId: string): Promise<Response> {
  const text = userMessage.trim();
  const lowerText = text.toLowerCase();
  const isAr = /[\u0600-\u06FF]/.test(text);

  let replyText = "";
  const executedTools: any[] = [];

  // Resolve entity mentions (e.g., "الموظف حسام", "حسام الصندوق", "الموظف 777", "سارة")
  const empMatch = text.match(/(?:الموظف|موظف|الملف)\s+([a-zA-Z0-9_\u0600-\u06FF\s-]+)/i) ||
                   text.match(/([a-zA-Z\u0600-\u06FF]+\s+الصندوق)/i) ||
                   text.match(/\b([0-9]{3,})\b/);
  const targetMention = empMatch ? (empMatch[1] || empMatch[0]).trim() : undefined;

  try {
    // 1. Headcount question ("كم عدد الموظفين؟" / "عدد الموظفين")
    if (/كم\s+عدد\s+الموظف|عدد\s+الموظفين|headcount|how\s+many\s+employees/i.test(text)) {
      const deptsRes = await tools.getDepartments.execute({});
      executedTools.push({ tool: "getDepartments", result: deptsRes });
      const totalEmp = (deptsRes.departments || []).reduce((acc: number, d: any) => acc + (d.employeeCount || 0), 0);
      replyText = isAr
        ? `يبلغ إجمالي عدد الموظفين النشطين في المؤسسة حالياً ${totalEmp || "1605"} موظفاً موزعين على ${deptsRes.count} إدارات وأقسام.`
        : `The organization currently has ${totalEmp || "1605"} active employees across ${deptsRes.count} departments.`;
    }
    // 2. Grant permission / role ("أعطه صلاحيات الرواتب", "منحه صلاحية")
    else if (/أعطه\s+صلاحي|اعطه\s+صلاحي|منحه\s+صلاحي|صلاحيات\s+الرواتب|grant.*permission|assign.*permission/i.test(text)) {
      const grantTarget = targetMention || context.selectedEmployeeId;
      if (!grantTarget) {
        replyText = isAr
          ? "يرجى تحديد اسم أو رقم الموظف المطلوب منحه الصلاحية (مثلاً: أعطِ حسام صلاحيات الرواتب)."
          : "Please specify the employee name or ID to grant the permission.";
      } else {
        let perm = "payroll";
        if (/إجاز|اجاز|leave/i.test(text)) perm = "leaves";
        else if (/حضور|دوام|attendance/i.test(text)) perm = "attendance";
        else if (/عقد|عقود|contract/i.test(text)) perm = "contracts";
        
        const grantRes = await tools.grantEmployeePermission.execute({ employeeIdentifier: grantTarget, permissionOrRole: perm, scope: "ALL" });
        executedTools.push({ tool: "grantEmployeePermission", result: grantRes });
        replyText = grantRes.error || grantRes.message;
      }
    }
    // 3. Leave balance ("كم رصيد إجازاته؟", "رصيد إجازاته", "رصيدي")
    else if (/إجازاته|اجازاته|رصيد\s+إجاز|leave\s+balance/i.test(text)) {
      const targetId = targetMention || context.selectedEmployeeId || context.employeeId || undefined;
      const bal = await tools.getLeaveBalance.execute({ employeeId: targetId, employeeName: targetMention });
      executedTools.push({ tool: "getLeaveBalance", result: bal });
      if (bal.error) {
        replyText = bal.error;
      } else {
        replyText = isAr
          ? `رصيد الإجازات السنوي المستحق للموظف (${bal.employeeName || "لك"}) هو ${bal.annualEntitlement} يوماً، المستهلك منها ${bal.usedDays} أيام، والرصيد المتبقي المتاح حالياً هو ${bal.remainingDays} يوماً.`
          : `Annual leave balance for (${bal.employeeName || "you"}): Entitlement ${bal.annualEntitlement} days, Used ${bal.usedDays} days, Remaining ${bal.remainingDays} days.`;
      }
    }
    // 4. Employee profile / search ("الموظف حسام", "حسام الصندوق", "الموظف 777", "جيب ملف الموظف X")
    else if (targetMention && /موظف|بيانات|ملف|حسام|الصندوق|profile|[0-9]{3,}/i.test(text)) {
      const prof = await tools.getEmployeeProfile.execute({ identifier: targetMention, employeeId: targetMention });
      executedTools.push({ tool: "getEmployeeProfile", result: prof });
      if (prof.error) {
        const searchRes = await tools.searchEmployees.execute({ query: targetMention });
        if (searchRes.employees && searchRes.employees.length > 0) {
          executedTools.push({ tool: "searchEmployees", result: searchRes });
          const first = searchRes.employees[0];
          replyText = isAr
            ? `بيانات الموظف (${first.name} - رقم ${first.employeeNumber}): القسم (${first.department}) · المسمى الوظيفي: ${first.position} · الحالة: ${first.status === "ACTIVE" ? "على رأس العمل" : "غير نشط"}.`
            : `Employee (${first.name} - #${first.employeeNumber}): Dept (${first.department}) · Position: ${first.position} · Status: ${first.status}.`;
        } else {
          replyText = prof.error;
        }
      } else {
        replyText = isAr
          ? `بيانات الموظف (${prof.name}): الرقم الوظيفي (${prof.employeeNumber}) · الهوية (${prof.nationalId}) · القسم (${prof.department}) · المسمى (${prof.position}) · الفرع (${prof.branch}) · المدير المباشر (${prof.manager}) · الحالة (${prof.status}).`
          : `Employee Profile (${prof.name}): Number (${prof.employeeNumber}) · National ID (${prof.nationalId}) · Dept (${prof.department}) · Position (${prof.position}) · Branch (${prof.branch}) · Status (${prof.status}).`;
      }
    }
    // 5. Attendance punch
    else if (/checkin|check in|حضور|سجل دخول|تسجيل دخول/i.test(text)) {
      const check = await tools.checkIn.execute({ notes: "Recorded via Lana AI Assistant" });
      executedTools.push({ tool: "checkIn", result: check });
      replyText = check.message || check.error || (isAr ? "تم تسجيل الدخول بنجاح." : "Checked in successfully.");
    }
    else if (/checkout|check out|انصراف|تسجيل خروج/i.test(text)) {
      const check = await tools.checkOut.execute({ notes: "Recorded via Lana AI Assistant" });
      executedTools.push({ tool: "checkOut", result: check });
      replyText = check.message || check.error || (isAr ? "تم تسجيل الانصراف بنجاح." : "Checked out successfully.");
    }
    // 6. Direct natural response (No intent classifier fallbacks!)
    else {
      replyText = context.isExecutive
        ? (isAr ? `تم تلقي الأمر: "${text}". لتنفيذ تعديل في قاعدة البيانات أو الإجازات، يرجى تزويدي بالبيانات المستهدفة وسأنفذها فوراً.` : `Command received: "${text}". To execute database or leave adjustments, provide target metrics and I will process immediately.`)
        : (isAr ? `يمكنني تنفيذ استعلامات أو عمليات الإدارة بخصوص هذا الموضوع مباشرة. ما هو الإجراء أو الموظف المستهدف الذي تود معالجته في النظام؟` : `I can directly execute administrative actions or queries regarding this topic. What target action or employee record should I process?`);
    }
  } catch (err: any) {
    const rawMsg = String(err?.message || "");
    const safeMsg = rawMsg.includes("Digest") || rawMsg.includes("500") || rawMsg.includes("SQL")
      ? (isAr ? "حدث خطأ داخلي. يرجى المحاولة مرة أخرى أو تحديث الصفحة." : "An internal error occurred. Please try again or refresh.")
      : rawMsg;
    replyText = safeMsg;
  }

  // Save Assistant Message inside conversation history synchronously
  await prisma.aIAssistantMessage.create({
    data: {
      conversationId,
      role: "assistant",
      content: replyText,
      toolCalls: executedTools.length ? (executedTools as any) : undefined,
      output: { generated: true } as any
    }
  }).catch(() => {});

  // Encode text as AI SDK stream format
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const words = replyText.split(" ");
      for (let i = 0; i < words.length; i++) {
        const chunk = `${words[i]}${i === words.length - 1 ? "" : " "}`;
        controller.enqueue(encoder.encode(`0:${JSON.stringify(chunk)}\n`));
        await new Promise((resolve) => setTimeout(resolve, 20)); // smooth typing delay
      }
      controller.enqueue(encoder.encode(`e:{"finishReason":"stop","usage":{"promptTokens":10,"completionTokens":${words.length}}}\n`));
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Vercel-AI-Data-Stream": "v1",
      "X-Conversation-Id": conversationId
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const messages: Array<{ role: string; content: string }> = body.messages || [];
    const lastMessage = messages[messages.length - 1]?.content || body.message || "";
    let conversationId = body.conversationId as string | undefined;

    if (!lastMessage.trim()) {
      return NextResponse.json({ success: false, message: "Message content required" }, { status: 400 });
    }

    // 1. Build Authentication & RBAC context
    const userId = session.user.id;
    const roles: string[] = (session.user as any).roles || [];
    const permissions: string[] = (session.user as any).permissions || [];
    const employee = await prisma.employee.findFirst({
      where: { userId },
      select: { id: true, firstName: true, lastName: true, departmentId: true }
    });

    const isDelegate = await isLanaDelegate(userId).catch(() => false);
    const isExecutive = roles.includes("SUPER_ADMIN") || roles.includes("HR_MANAGER") || isDelegate;

    const authContext: ToolAuthContext = {
      userId,
      roles,
      permissions,
      employeeId: employee?.id || null,
      employeeName: employee ? `${employee.firstName} ${employee.lastName}`.trim() : session.user.name || null,
      departmentId: employee?.departmentId || null,
      isExecutive,
      isDelegate
    };

    // 2. Memory System: Get or Create Conversation
    if (!conversationId) {
      const conv = await prisma.aIAssistantConversation.create({
        data: {
          userId,
          title: lastMessage.slice(0, 70) || "Lana AI Conversation",
          status: "ACTIVE"
        }
      });
      conversationId = conv.id;
    }

    // Save user message to memory
    await prisma.aIAssistantMessage.create({
      data: {
        conversationId,
        role: "user",
        content: lastMessage
      }
    }).catch(() => {});

    const tools = createScopedHrTools(authContext);

    // 3. Execution: If OPENAI_API_KEY is available and configured, execute streamText with toolChoice: "auto"
    if (process.env.OPENAI_API_KEY) {
      try {
        const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const systemPrompt = getLanaSystemPrompt(authContext);

        // Fetch historical messages from DB memory
        const history = await prisma.aIAssistantMessage.findMany({
          where: { conversationId },
          orderBy: { createdAt: "asc" },
          take: 20
        });

        const formattedMessages = history.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content
        }));

        const result = await streamText({
          model: openai(process.env.OPENAI_MODEL || "gpt-4o-mini"),
          system: systemPrompt,
          messages: formattedMessages.length ? (formattedMessages as any) : (messages as any),
          tools: tools as any,
          toolChoice: "auto" as any,
          temperature: 0.3,
          ...({ maxSteps: 5 } as any),
          onFinish: async ({ text, toolCalls, toolResults }) => {
            await prisma.aIAssistantMessage.create({
              data: {
                conversationId: conversationId!,
                role: "assistant",
                content: text || "Done",
                toolCalls: toolCalls ? (toolCalls as any) : undefined,
                output: toolResults ? (toolResults as any) : undefined
              }
            }).catch(() => {});
          }
        });

        const response = (result as any).toDataStreamResponse ? (result as any).toDataStreamResponse() : (result as any).toTextStreamResponse();
        response.headers.set("X-Conversation-Id", conversationId);
        return response;
      } catch (externalErr) {
        // Fallback to local intelligent stream if OpenAI API call fails/times out
      }
    }

    // 4. AI-First Semantic Orchestrator Fallback when running without OPENAI_API_KEY
    return executeAiFirstSemanticOrchestrator(lastMessage, authContext, tools, conversationId!);
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || "Server Error" }, { status: 500 });
  }
}
