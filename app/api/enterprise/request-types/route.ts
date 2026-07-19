import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { REQUEST_TYPE_CONFIG } from "@/lib/employee/request-form-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    // Dynamically fetch unique request types that have been used across WorkflowInstance and EmployeeRequest
    const [workflowTypes, employeeRequestTypes] = await Promise.all([
      prisma.workflowInstance.findMany({
        select: { type: true },
        distinct: ["type"]
      }).catch(() => []),
      prisma.employeeRequest.findMany({
        select: { type: true },
        distinct: ["type"]
      }).catch(() => [])
    ]);

    const dynamicCodes = new Set([
      ...workflowTypes.map((w) => w.type),
      ...employeeRequestTypes.map((e) => e.type)
    ]);

    // Build unified dynamic request types list with Arabic labels
    const requestTypesMap = new Map<string, { code: string; label: string }>();

    // First seed with core institutional request types from REQUEST_TYPE_CONFIG
    for (const config of REQUEST_TYPE_CONFIG) {
      requestTypesMap.set(config.code, { code: config.code, label: config.label });
    }

    // Also ensure core request types like LEAVE, RESUMPTION, OVERTIME, LOAN, EXPENSE have explicit full labels
    if (!requestTypesMap.has("LEAVE")) requestTypesMap.set("LEAVE", { code: "LEAVE", label: "طلبات الإجازات" });
    if (!requestTypesMap.has("RESUMPTION")) requestTypesMap.set("RESUMPTION", { code: "RESUMPTION", label: "طلب المباشرة بعد الإجازة" });
    if (!requestTypesMap.has("OVERTIME")) requestTypesMap.set("OVERTIME", { code: "OVERTIME", label: "طلبات الأوفر تايم" });
    if (!requestTypesMap.has("LOAN")) requestTypesMap.set("LOAN", { code: "LOAN", label: "طلبات السلف والقروض" });
    if (!requestTypesMap.has("EXPENSE")) requestTypesMap.set("EXPENSE", { code: "EXPENSE", label: "طلبات المصاريف والعُهد" });

    // Then fold in any additional dynamic types discovered directly in Prisma database
    for (const code of dynamicCodes) {
      if (!code) continue;
      if (!requestTypesMap.has(code)) {
        const matchingConfig = REQUEST_TYPE_CONFIG.find((c) => c.code.toUpperCase() === code.toUpperCase());
        requestTypesMap.set(code, {
          code,
          label: matchingConfig ? matchingConfig.label : `طلبات ${code}`
        });
      }
    }

    const requestTypes = Array.from(requestTypesMap.values()).sort((a, b) => a.label.localeCompare(b.label, "ar"));

    return NextResponse.json({ success: true, requestTypes });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || "Failed to load dynamic request types" }, { status: 500 });
  }
}
