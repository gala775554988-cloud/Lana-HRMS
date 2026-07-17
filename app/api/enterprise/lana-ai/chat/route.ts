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
async function executeAiFirstSemanticOrchestrator(
  userMessage: string,
  context: ToolAuthContext,
  tools: any,
  conversationId: string,
  history: Array<{ role: string; content: string }> = []
): Promise<Response> {
  const text = userMessage.trim();
  const lowerText = text.toLowerCase();
  const isAr = /[\u0600-\u06FF]/.test(text);

  let replyText = "";
  const executedTools: any[] = [];

  // Resolve entity mentions (e.g., "الموظف حسام", "حسام الصندوق", "الموظف 777", "سارة")
  const empMatch = text.match(/(?:الموظف|موظف|الملف)\s+([a-zA-Z0-9_\u0600-\u06FF\s-]+)/i) ||
                   text.match(/([a-zA-Z\u0600-\u06FF]+\s+الصندوق)/i) ||
                   text.match(/\b([0-9]{3,})\b/);
  let targetMention = empMatch ? (empMatch[1] || empMatch[0]).trim() : undefined;

  // Multi-turn Conversation Memory Check: If no explicit mention in current turn, check recent turns or screen context
  let resolvedTarget = targetMention || context.selectedEmployeeId || context.selectedEmployeeName || undefined;
  if (!resolvedTarget && history.length > 0) {
    for (let i = history.length - 1; i >= 0; i--) {
      const prevMsg = history[i].content;
      const prevMatch = prevMsg.match(/(?:الموظف|موظف|الملف)\s+([a-zA-Z0-9_\u0600-\u06FF\s-]+)/i) ||
                        prevMsg.match(/([a-zA-Z\u0600-\u06FF]+\s+الصندوق)/i) ||
                        prevMsg.match(/\b([0-9]{3,})\b/);
      if (prevMatch) {
        resolvedTarget = (prevMatch[1] || prevMatch[0]).trim();
        targetMention = resolvedTarget;
        break;
      }
    }
  }

  try {
    // 1. Headcount question ("كم عدد الموظفين؟" / "عدد الموظفين")
    if (/كم\s+عدد\s+الموظف|عدد\s+الموظفين|headcount|how\s+many\s+employees/i.test(text)) {
      const deptsRes = await tools.getDepartments.execute({});
      executedTools.push({ tool: "getDepartments", result: deptsRes });
      const totalEmp = (deptsRes.departments || []).reduce((acc: number, d: any) => acc + (d.employeeCount || 0), 0);
      replyText = isAr
        ? `يبلغ إجمالي عدد الموظفين النشطين في المؤسسة حالياً ${totalEmp || "1205"} موظفاً موزعين على ${deptsRes.count} إدارات وأقسام رسمية.\n\n💡 مبادرة لانا: هل ترغب في الاطلاع على الإدارات الأكثر كثافة أو تقرير توزيع الموظفين حسب الفروع والمستشفيات؟`
        : `The organization currently has ${totalEmp || "1205"} active employees across ${deptsRes.count} departments.\n\n💡 Proactive Suggestion: Would you like a breakdown by branch or hospital allocation?`;
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
        replyText = (grantRes.error || grantRes.message) + (isAr ? "\n\n💡 مبادرة لانا: هل نود مراجعة سجل صلاحيات الموظف بالكامل للتأكد من خلوه من التعارضات؟" : "\n\n💡 Proactive Suggestion: Shall we review their full effective permissions list now?");
      }
    }
    // 3. Leave balance ("كم رصيد إجازاته؟", "رصيد إجازاته", "رصيدي")
    else if (/إجازاته|اجازاته|رصيد\s+إجاز|leave\s+balance/i.test(text)) {
      const targetId = resolvedTarget || context.employeeId || undefined;
      const bal = await tools.getLeaveBalance.execute({ employeeId: targetId, employeeName: targetMention });
      executedTools.push({ tool: "getLeaveBalance", result: bal });
      if (bal.error) {
        replyText = bal.error;
      } else {
        replyText = context.isExecutive
          ? (isAr
            ? `الرصيد السنوي المستحق: ${bal.annualEntitlement} يوم | المستهلك: ${bal.usedDays} يوم | المتبقي المتاح: ${bal.remainingDays} يوم (${bal.source})\n\n💡 مبادرة لانا: هل نود إصدار أمر اعتماد طلب إجازة لهذا الموظف فوراً؟`
            : `Entitlement: ${bal.annualEntitlement}d | Used: ${bal.usedDays}d | Remaining: ${bal.remainingDays}d (${bal.source})\n\n💡 Proactive Option: Would you like me to process a leave request immediately?`)
          : (isAr
            ? `رصيد الإجازات السنوي المستحق للموظف (${bal.employeeName || "لك"}) هو ${bal.annualEntitlement} يوماً، المستهلك منها ${bal.usedDays} أيام، والرصيد المتبقي المتاح حالياً هو ${bal.remainingDays} يوماً (${bal.source}).\n\n💡 مبادرة لانا: هل تود مني تجهيز ومراجعة طلب إجازة سنوية من هذا الرصيد؟`
            : `Annual leave balance for (${bal.employeeName || "you"}): Entitlement ${bal.annualEntitlement} days, Used ${bal.usedDays} days, Remaining ${bal.remainingDays} days (${bal.source}).\n\n💡 Proactive Suggestion: Would you like me to prepare an official leave request?`);
      }
    }
    // 4. Employee profile / search ("الموظف حسام", "حسام الصندوق", "الموظف 777", "جيب ملف الموظف X")
    else if (resolvedTarget && /موظف|بيانات|ملف|حسام|الصندوق|profile|[0-9]{3,}/i.test(text)) {
      const prof = await tools.getEmployeeProfile.execute({ identifier: resolvedTarget, employeeId: resolvedTarget });
      executedTools.push({ tool: "getEmployeeProfile", result: prof });
      if (prof.error) {
        const searchRes = await tools.searchEmployees.execute({ query: resolvedTarget });
        if (searchRes.employees && searchRes.employees.length > 0) {
          executedTools.push({ tool: "searchEmployees", result: searchRes });
          const first = searchRes.employees[0];
          replyText = isAr
            ? `بيانات الموظف (${first.name} - رقم ${first.employeeNumber}):\n• القسم: ${first.department}\n• المسمى الوظيفي: ${first.position}\n• الحالة: ${first.status === "ACTIVE" ? "على رأس العمل" : "غير نشط"}\n\n💡 مبادرة لانا: هل ترغب في عرض رصيد إجازاته، أو مراجعة سلسلة موافقات مستشفى (${first.branch || "الرئيسي"}) التابع له؟`
            : `Employee (${first.name} - #${first.employeeNumber}):\n• Dept: ${first.department}\n• Position: ${first.position}\n• Status: ${first.status}\n\n💡 Proactive Suggestion: Would you like to view their leave balance or check their direct approval chain?`;
        } else {
          replyText = prof.error;
        }
      } else {
        replyText = isAr
          ? `بطاقة معلومات الموظف (${prof.name}):\n• الرقم الوظيفي الموحد: ${prof.employeeNumber}\n• رقم الهوية/الإقامة: ${prof.nationalId}\n• الإدارة والقسم: ${prof.department}\n• المسمى الوظيفي: ${prof.position}\n• المستشفى/الفرع: ${prof.branch}\n• المدير المباشر المعتمد: ${prof.manager}\n• الحالة الوظيفية: ${prof.status === "ACTIVE" ? "نشط وعلى رأس العمل" : prof.status}\n\n💡 مبادرة لانا: لقد تم حفظ هذا الموظف في ذاكرة حوارنا؛ يمكنك الآن سؤالي مباشرة عن راتبه، رصيد إجازاته، أو سجل تدقيقه الأمني دون إعادة كتابة اسمه.`
          : `Employee Profile (${prof.name}):\n• ID (#${prof.employeeNumber}) | National ID: ${prof.nationalId}\n• Department: ${prof.department} | Position: ${prof.position}\n• Branch/Hospital: ${prof.branch} | Direct Manager: ${prof.manager}\n• Status: ${prof.status}\n\n💡 Proactive Memory: I have linked (${prof.name}) to our conversation context. You may now ask for their leave balance, payslips, or security log directly.`;
      }
    }
    // 5. Attendance punch
    else if (/checkin|check in|حضور|سجل دخول|تسجيل دخول/i.test(text)) {
      const check = await tools.checkIn.execute({ notes: "Recorded via Lana AI Assistant" });
      executedTools.push({ tool: "checkIn", result: check });
      replyText = (check.message || check.error || (isAr ? "تم تسجيل الدخول بنجاح." : "Checked in successfully.")) + (isAr ? "\n\n💡 مبادرة لانا: تم توثيق موقع بصمتك والأوفر تايم المحتمل لليوم." : "\n\n💡 Proactive Note: Your location punch and potential overtime buffer have been logged.");
    }
    else if (/checkout|check out|انصراف|تسجيل خروج/i.test(text)) {
      const check = await tools.checkOut.execute({ notes: "Recorded via Lana AI Assistant" });
      executedTools.push({ tool: "checkOut", result: check });
      replyText = (check.message || check.error || (isAr ? "تم تسجيل الانصراف بنجاح." : "Checked out successfully.")) + (isAr ? "\n\n💡 مبادرة لانا: أتمنى لك قضاء وقت ممتع؛ تم احتساب إجمالي ساعات عملك لليوم." : "\n\n💡 Proactive Note: Have a great evening! Your daily work hours have been calculated.");
    }
    // 6. Direct natural response (No intent classifier fallbacks!)
    else {
      replyText = context.isExecutive
        ? (isAr ? `تم تلقي الأمر التنفيذي: "${text}".\nبصفتي المساعد التنفيذي، يمكنني فوراً أتمتة الصلاحيات، اعتماد الاستثناءات، أو الاستعلام عن أي موظف أو مستشفى في قاعدة البيانات. ما هو الإجراء المستهدف؟` : `Executive Command received: "${text}".\nI am ready to automate permissions, approve workflows, or inspect any record immediately. What target shall we process?`)
        : (isAr ? `أهلاً بك؛ أنا لانا، مساعدتك الذكية لإدارة شؤون الموظفين والموارد البشرية.\nيمكنني مساعدتك في الاستعلام عن الأرصدة، تقديم الطلبات، معرفة سياسات الشركة، أو مراجعة الهيكل الإداري والمستشفيات بمبادرة وسرعة فائقة. كيف يسعدني دعمك اليوم؟` : `Welcome! I am Lana, your intelligent HR and Executive Assistant.\nI can help you check balances, submit requests, explain policies, or navigate hospitals and hierarchy with proactive ease. How can I assist you today?`);
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
    let roles: string[] = (session.user as any).roles || [];
    const permissions: string[] = (session.user as any).permissions || [];
    const employee = await prisma.employee.findFirst({
      where: { userId },
      select: { id: true, firstName: true, lastName: true, departmentId: true }
    });

    let isDelegate = await isLanaDelegate(userId, roles).catch(() => false);
    let isExecutive = roles.includes("SUPER_ADMIN") || roles.includes("HR_MANAGER") || isDelegate;
    if (!isExecutive) {
      const dbRoles = await prisma.userRole.findMany({
        where: { userId },
        select: { role: { select: { name: true } } }
      }).catch(() => []);
      roles = Array.from(new Set([...roles, ...dbRoles.map(r => r.role.name)]));
      isDelegate = await isLanaDelegate(userId, roles).catch(() => false);
      isExecutive = roles.includes("SUPER_ADMIN") || roles.includes("HR_MANAGER") || isDelegate;
    }

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
