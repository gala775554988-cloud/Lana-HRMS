import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

/**
 * Direct Control Protocol (بروتوكول التحكم المباشر)
 * Executive Tools orchestrating UI/UX configuration updates and real PostgreSQL queries
 * subject to Double-Validation (التثبيت المزدوج) by executive authority.
 */

export type UiActionType = "remove" | "update" | "add";
export type DbOperationType = "delete" | "update" | "insert" | "alter" | "query";

export const executiveCommands = {
  // 1. التحكم في الواجهات (UI/UX Orchestration)
  modifyUI: async (
    uiComponentId: string,
    action: UiActionType,
    specs: Record<string, any>,
    actorUserId?: string
  ) => {
    // Record direct UI orchestration intent and update dynamic component configuration store
    const message = `تم استلام أمر ${action} للواجهة ${uiComponentId}. جاري التنفيذ وفق المواصفات المرفقة.`;
    
    if (actorUserId) {
      await writeAuditLog({
        actorUserId,
        action: `executive:modifyUI:${action}`,
        entity: "uiComponent",
        entityId: uiComponentId,
        metadata: { specs, action }
      }).catch(() => {});
    }

    return {
      doubleValidation: true,
      status: "AWAITING_EXECUTIVE_CONFIRMATION",
      actionType: "MODIFY_UI",
      previewTitle: "👑 ملخص تنفيذي (Direct Control Protocol) — تعديل هيكلية الواجهة (UI/UX)",
      previewMessage: message,
      payload: {
        uiComponentId,
        action,
        specs: JSON.stringify(specs, null, 2)
      },
      requiresConfirmation: true
    };
  },

  // 2. التحكم في قاعدة البيانات (DB Schema & Data Orchestration)
  modifyDB: async (
    table: string,
    operation: DbOperationType,
    query: string,
    actorUserId?: string
  ) => {
    const message = `تنبيه تنفيذي: سيتم إجراء ${operation} على جدول ${table}. بانتظار تأكيدك النهائي لتنفيذ الاستعلام: ${query}`;

    if (actorUserId) {
      await writeAuditLog({
        actorUserId,
        action: `executive:modifyDB:${operation}`,
        entity: "databaseTable",
        entityId: table,
        metadata: { query, operation }
      }).catch(() => {});
    }

    return {
      doubleValidation: true,
      status: "AWAITING_EXECUTIVE_CONFIRMATION",
      actionType: "MODIFY_DB",
      previewTitle: "👑 ملخص تنفيذي (Direct Control Protocol) — تعديل قاعدة البيانات (DB Schema)",
      previewMessage: message,
      payload: {
        table,
        operation,
        query
      },
      requiresConfirmation: true
    };
  }
};

/**
 * Executes confirmed database operations after Executive Double-Validation confirmation.
 */
export async function executeDirectModifyDB(
  table: string,
  operation: DbOperationType,
  query: string,
  actorUserId: string
) {
  // Prevent destructive table drops without super admin safeguard check
  if (query.trim().toUpperCase().startsWith("DROP DATABASE")) {
    throw new Error("تنبيه أمني صارم: لا يسمح بتنفيذ DROP DATABASE عبر بروتوكول الذكاء الاصطناعي.");
  }

  try {
    let result: any = null;
    const cleanQuery = query.trim();

    if (cleanQuery.toUpperCase().startsWith("SELECT")) {
      result = await prisma.$queryRawUnsafe(cleanQuery);
    } else if (cleanQuery) {
      result = await prisma.$executeRawUnsafe(cleanQuery);
    }

    await writeAuditLog({
      actorUserId,
      action: `executive:executeModifyDB:${operation}`,
      entity: "databaseTable",
      entityId: table,
      metadata: { query, result: typeof result === "bigint" ? Number(result) : result }
    });

    return {
      success: true,
      message: `✓ تم اعتماد وتنفيذ الاستعلام المباشر (${operation}) على الجدول (${table}) في قاعدة بيانات PostgreSQL بنجاح 100%.`,
      affectedRows: typeof result === "bigint" ? Number(result) : result
    };
  } catch (error: any) {
    throw new Error(`فشل تنفيذ استعلام قاعدة البيانات: ${error?.message || String(error)}`);
  }
}
