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
 * Intelligent, localized natural answer generator for Lana when running locally without OPENAI_API_KEY.
 * Follows all ChatGPT communication guidelines (no robotic intros, concise, natural, bilingual, scoped tool calling).
 */
async function generateLocalLanaStream(userMessage: string, context: ToolAuthContext, tools: any, conversationId: string): Promise<Response> {
  const text = userMessage.trim().toLowerCase();
  const isAr = /[\u0600-\u06FF]/.test(userMessage);

  let replyText = "";
  const executedTools: any[] = [];

  // Local Intent Analysis & Automated Tool Execution
  try {
    if (/ملف\s+الموظف|بيانات\s+الموظف|جيب\s+ملف|employee\s+profile|getEmployeeProfile|ملف\s+موظف/i.test(text)) {
      const match = text.match(/موظف\s+([a-zA-Z0-9_\u0600-\u06FF-]+)/i) || text.match(/profile\s+([a-zA-Z0-9_-]+)/i);
      const identifier = match ? match[1].trim() : undefined;
      const prof = await tools.getEmployeeProfile.execute({ identifier, employeeId: identifier });
      executedTools.push({ tool: "getEmployeeProfile", result: prof });
      if (prof.error) {
        replyText = isAr ? `عذراً: ${prof.error}` : `Sorry: ${prof.error}`;
      } else {
        replyText = isAr
          ? `بيانات الموظف (${prof.name}): الرقم الوظيفي (${prof.employeeNumber}) · الهوية (${prof.nationalId}) · القسم (${prof.department}) · المسمى (${prof.position}) · الفرع (${prof.branch}) · المدير المباشر (${prof.manager}) · الحالة (${prof.status}).`
          : `Employee Profile (${prof.name}): Number (${prof.employeeNumber}) · National ID (${prof.nationalId}) · Dept (${prof.department}) · Position (${prof.position}) · Branch (${prof.branch}) · Status (${prof.status}).`;
      }
    } else if (/leave|إجاز|اجاز|رصيد إجاز/i.test(text)) {
      if (/تقديم|طلب جديد|أقدم|اطلب|تقديم إجاز/i.test(text)) {
        replyText = isAr
          ? "افتح صفحة الإجازات ثم اضغط \"طلب جديد\"، واختر نوع الإجازة وحدد التاريخ ثم أرسل الطلب."
          : "Open the Leave page, click \"New Request\", select the leave type, choose your dates, and submit the request.";
      } else {
        const nameMatch = text.match(/رصيد\s+إجازة\s+([a-zA-Z0-9_\u0600-\u06FF\s]+)/i) || text.match(/leave\s+balance\s+for\s+([a-zA-Z0-9_\s]+)/i);
        const targetName = nameMatch ? nameMatch[1].trim() : undefined;
        const bal = await tools.getLeaveBalance.execute({ employeeId: targetName ? undefined : context.employeeId, employeeName: targetName });
        executedTools.push({ tool: "getLeaveBalance", result: bal });
        if (bal.error) {
          replyText = isAr ? `عذراً: ${bal.error}` : `Sorry: ${bal.error}`;
        } else {
          replyText = isAr
            ? `رصيد الإجازات السنوي المستحق للموظف (${bal.employeeName || "لك"}) هو ${bal.annualEntitlement} يوماً، المستهلك منها ${bal.usedDays} أيام، والرصيد المتبقي المتاح حالياً هو ${bal.remainingDays} يوماً.`
            : `Annual leave balance for (${bal.employeeName || "you"}): Entitlement ${bal.annualEntitlement} days, Used ${bal.usedDays} days, Remaining ${bal.remainingDays} days.`;
        }
      }
    } else if (/checkin|check in|حضور|سجل دخول|تسجيل دخول|دخول اليوم/i.test(text)) {
      if (/سجل لي دخول|check me in|أبي أسجل دخول|تسجيل دخول الآن/i.test(text)) {
        const check = await tools.checkIn.execute({ notes: "Recorded via Lana AI Assistant" });
        executedTools.push({ tool: "checkIn", result: check });
        replyText = isAr ? check.message || (check.error ? `عذراً: ${check.error}` : "تم تسجيل دخولك بنجاح.") : check.message || (check.error ? `Error: ${check.error}` : "Checked in successfully.");
      } else {
        const att = await tools.getAttendance.execute({ days: 5 });
        executedTools.push({ tool: "getAttendance", result: att });
        if (att.error || !att.records?.length) {
          replyText = isAr ? "لا توجد سجلات حضور حديثة مسجلة في الأيام الماضية." : "No recent attendance records found.";
        } else {
          const latest = att.records[0];
          replyText = isAr
            ? `آخر سجل حضور لك كان يوم ${latest.date}: وقت الدخول (${latest.checkIn}) ووقت الخروج (${latest.checkOut}) والحالة (${latest.status}).`
            : `Your latest attendance on ${latest.date}: Check-in (${latest.checkIn}), Check-out (${latest.checkOut}), Status (${latest.status}).`;
        }
      }
    } else if (/checkout|check out|انصراف|تسجيل خروج/i.test(text)) {
      const check = await tools.checkOut.execute({ notes: "Recorded via Lana AI Assistant" });
      executedTools.push({ tool: "checkOut", result: check });
      replyText = isAr ? check.message || (check.error ? `عذراً: ${check.error}` : "تم تسجيل انصرافك بنجاح.") : check.message || (check.error ? `Error: ${check.error}` : "Checked out successfully.");
    } else if (/salary|payroll|payslip|راتب|مسير|قسيمة/i.test(text)) {
      const pay = await tools.getPayroll.execute({});
      executedTools.push({ tool: "getPayroll", result: pay });
      if (pay.error || (!pay.payslips?.length && !pay.baseSalary)) {
        replyText = isAr ? "لا توجد تفاصيل رواتب أو مسيرات مسجلة في ملفك بعد." : "No payroll records or salary details found.";
      } else if (pay.payslips?.length) {
        const latestPay = pay.payslips[0];
        replyText = isAr
          ? `آخر مسير راتب لك للفترة (${latestPay.period}): الراتب الأساسي ${latestPay.baseSalary} ريال، صافي الراتب المستحق ${latestPay.netPay} ريال.`
          : `Your latest payslip for period (${latestPay.period}): Base Salary ${latestPay.baseSalary} SAR, Net Pay ${latestPay.netPay} SAR.`;
      } else {
        replyText = isAr ? `الراتب الأساسي المسجل في عقدك هو ${pay.baseSalary} ريال.` : `Your registered contract base salary is ${pay.baseSalary} SAR.`;
      }
    } else if (/policy|سياس|لائحة|قانون|شروط/i.test(text)) {
      const topic = /leave|إجاز/i.test(text) ? "leave" : /attendance|دوام|حضور/i.test(text) ? "attendance" : /overtime|إضافي|أوفر/i.test(text) ? "overtime" : /loan|سلف/i.test(text) ? "loans" : "general";
      const pol = await tools.getCompanyPolicies.execute({ topic });
      executedTools.push({ tool: "getCompanyPolicies", result: pol });
      replyText = pol.policyContent;
    } else if (/department|قسم|أقسام|إدارات/i.test(text)) {
      const depts = await tools.getDepartments.execute();
      executedTools.push({ tool: "getDepartments", result: depts });
      replyText = isAr
        ? `تضم الشركة حالياً ${depts.count} أقسام وإدارات نشطة. يمكنك الاطلاع عليها وتفاصيل موظفيها من وحدة الهيكل التنظيمي.`
        : `The company currently has ${depts.count} active departments. You can view them in the Organization Hierarchy module.`;
    } else if (/مرحبا|هلا|شلونك|كيف حالك|hello|hi|hey|morning/i.test(text)) {
      replyText = context.isExecutive
        ? (isAr ? "جاهزة لتنفيذ الأوامر الفورية والاستعلامات المؤسسية." : "Ready for immediate executive commands or institutional lookups.")
        : (isAr ? "تفضل، كيف أستطيع مساعدتك اليوم في مواضيع شؤون الموظفين؟" : "How can I help you today with your HR inquiries or data lookups?");
    } else {
      replyText = context.isExecutive
        ? (isAr ? "يرجى تحديد الإجراء التنفيذي المطلوب فوراً (مثلاً: جلب ملف الموظف X أو استعلام رصيد الإجازات)." : "Please specify the direct executive action required (e.g., get employee profile X or check leave balance).")
        : (isAr ? "للقيام بعمليات محددة مثل (عرض رصيد الإجازات، تسجيل الحضور، استعراض الراتب)، يمكنك سؤالي مباشرة وسأقوم بتنفيذها فوراً حسب صلاحياتك." : "For specific system operations (like checking leave balance, attendance punches, viewing salary slips), ask me directly and I will execute them immediately.");
    }
  } catch (err: any) {
    const rawMsg = String(err?.message || "");
    const safeMsg = rawMsg.includes("Digest") || rawMsg.includes("500") || rawMsg.includes("SQL")
      ? (isAr ? "حدث خطأ داخلي. يرجى المحاولة مرة أخرى أو تحديث الصفحة." : "An internal error occurred. Please try again or refresh.")
      : rawMsg;
    replyText = isAr ? `عذراً: ${safeMsg}` : `Error: ${safeMsg}`;
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

    // 4. Localized Intelligent Stream Fallback
    return generateLocalLanaStream(lastMessage, authContext, tools, conversationId);
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || "Server Error" }, { status: 500 });
  }
}
