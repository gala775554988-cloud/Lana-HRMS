import "server-only";

import { prisma } from "@/lib/prisma";

export type RequestDetailField = {
  label: string;
  value: string | number | null;
  tone?: "default" | "money" | "date" | "duration";
};

export type RequestEntityDetails = {
  title: string;
  reference: string;
  status: string;
  fields: RequestDetailField[];
  attachments: Array<{ name: string; url: string }>;
};

function iso(value: Date | null | undefined) {
  return value?.toISOString() ?? null;
}

function money(value: unknown) {
  if (value === null || value === undefined) return null;
  return Number(value);
}

export async function getRequestEntityDetails(type: string, entityId: string): Promise<RequestEntityDetails | null> {
  if (type === "LEAVE") {
    const row = await prisma.leaveRequest.findUnique({ where: { id: entityId }, include: { leaveType: { select: { name: true } } } });
    if (!row) return null;
    return {
      title: `إجازة ${row.leaveType.name}`,
      reference: row.id,
      status: row.status,
      fields: [
        { label: "نوع الإجازة", value: row.leaveType.name },
        { label: "من تاريخ", value: iso(row.startDate), tone: "date" },
        { label: "إلى تاريخ", value: iso(row.endDate), tone: "date" },
        { label: "المدة", value: Number(row.days), tone: "duration" },
        { label: "السبب", value: row.reason },
        { label: "ملاحظة القرار", value: row.decisionNote }
      ],
      attachments: []
    };
  }

  if (type === "OVERTIME") {
    const [row, extraSetting] = await Promise.all([
      prisma.overtimeRequest.findUnique({ where: { id: entityId } }),
      prisma.appSetting.findUnique({ where: { key: `overtime.extra.${entityId}` }, select: { value: true } }).catch(() => null)
    ]);
    if (!row) return null;
    const extra = (extraSetting?.value && typeof extraSetting.value === "object" ? extraSetting.value : {}) as Record<string, unknown>;
    return {
      title: "طلب عمل إضافي",
      reference: row.id,
      status: row.status,
      fields: [
        { label: "تاريخ العمل", value: iso(row.workDate), tone: "date" },
        { label: "من الساعة", value: String(extra.startTime ?? "-") },
        { label: "إلى الساعة", value: String(extra.endTime ?? "-") },
        { label: "الساعات المحتسبة", value: Number(row.hours), tone: "duration" },
        { label: "طريقة التعويض", value: extra.compensationMode === "TIME_OFF" ? "رصيد إجازة تعويضية" : "مقابل مالي" },
        { label: "القيمة التقديرية", value: money(row.amount ?? extra.amount), tone: "money" },
        { label: "معامل الاحتساب", value: Number(row.rate) },
        { label: "المشروع / مركز التكلفة", value: String(extra.project ?? "-") },
        { label: "الملاحظات", value: row.reason }
      ],
      attachments: []
    };
  }

  if (type === "EXPENSE") {
    const row = await prisma.expenseRequest.findUnique({ where: { id: entityId } });
    if (!row) return null;
    return {
      title: `مصروف ${row.category}`,
      reference: row.id,
      status: row.status,
      fields: [
        { label: "الفئة", value: row.category },
        { label: "المبلغ", value: money(row.amount), tone: "money" },
        { label: "الوصف", value: row.description }
      ],
      attachments: row.receiptUrl ? [{ name: "إيصال المصروف", url: row.receiptUrl }] : []
    };
  }

  if (type === "LETTER") {
    const row = await prisma.letterRequest.findUnique({ where: { id: entityId } });
    if (!row) return null;
    return {
      title: `خطاب ${row.letterType}`,
      reference: row.id,
      status: row.status,
      fields: [
        { label: "نوع الخطاب", value: row.letterType },
        { label: "الغرض", value: row.purpose }
      ],
      attachments: row.fileUrl ? [{ name: "الخطاب", url: row.fileUrl }] : []
    };
  }

  if (type === "RESUMPTION") {
    const row = await prisma.resumptionRequest.findUnique({ where: { id: entityId } });
    if (!row) return null;
    return {
      title: "طلب مباشرة عمل",
      reference: row.id,
      status: row.status,
      fields: [
        { label: "تاريخ المباشرة", value: iso(row.returnDate), tone: "date" },
        { label: "نوع المباشرة", value: row.resumptionType },
        { label: "السبب", value: row.reason },
        { label: "الملاحظات", value: row.notes },
        { label: "ملاحظة القرار", value: row.decisionNote }
      ],
      attachments: []
    };
  }

  return {
    title: "طلب موظف",
    reference: entityId,
    status: "PENDING",
    fields: [{ label: "نوع الطلب", value: type }],
    attachments: []
  };
}
