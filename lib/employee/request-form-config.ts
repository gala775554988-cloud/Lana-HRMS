export type RequestFieldKind = "text" | "textarea" | "date" | "number" | "select";

export type RequestField = {
  name: string;
  label: string;
  kind: RequestFieldKind;
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
};

export type RequestTypeConfig = {
  code: string; // matches WorkflowInstance.type / CATEGORY_LABELS keys
  label: string;
  fields: RequestField[];
};

export const REQUEST_TYPE_CONFIG: RequestTypeConfig[] = [
  {
    code: "LEAVE",
    label: "طلبات الإجازات",
    fields: [
      {
        name: "leaveType", label: "نوع الإجازة", kind: "select", required: true,
        options: [
          { value: "ANNUAL", label: "سنوية" },
          { value: "SICK", label: "مرضية" },
          { value: "EMERGENCY", label: "طارئة" },
        ],
      },
      { name: "startDate", label: "تاريخ البداية", kind: "date", required: true },
      { name: "endDate", label: "تاريخ النهاية", kind: "date", required: true },
      { name: "reason", label: "السبب", kind: "textarea" },
    ],
  },
  {
    code: "EXPENSE",
    label: "طلبات المصروفات",
    fields: [
      { name: "amount", label: "المبلغ", kind: "number", required: true },
      { name: "category", label: "التصنيف", kind: "text", placeholder: "مثال: مواصلات" },
      { name: "description", label: "الوصف", kind: "textarea" },
    ],
  },
  {
    code: "LOAN",
    label: "طلبات السلف",
    fields: [
      { name: "amount", label: "المبلغ", kind: "number", required: true },
      { name: "notes", label: "ملاحظات", kind: "textarea" },
    ],
  },
  {
    code: "LETTER",
    label: "طلبات الخطابات",
    fields: [
      {
        name: "letterType", label: "نوع الخطاب", kind: "select", required: true,
        options: [
          { value: "salary", label: "خطاب راتب" },
          { value: "employment", label: "خطاب تعريف" },
          { value: "experience", label: "خطاب خبرة" },
          { value: "other", label: "أخرى" },
        ],
      },
      { name: "purpose", label: "الغرض", kind: "textarea" },
    ],
  },
  {
    code: "OVERTIME",
    label: "طلبات الأوفر تايم",
    fields: [
      { name: "workDate", label: "تاريخ العمل", kind: "date", required: true },
      { name: "hours", label: "عدد الساعات", kind: "number", required: true },
      { name: "reason", label: "السبب", kind: "textarea" },
    ],
  },
  {
    code: "CUSTODY",
    label: "طلبات العهد",
    fields: [{ name: "purpose", label: "تفاصيل الطلب", kind: "textarea", required: true }],
  },
  {
    code: "DELEGATION",
    label: "طلبات الانتدابات",
    fields: [{ name: "purpose", label: "تفاصيل الطلب", kind: "textarea", required: true }],
  },
  {
    code: "DOCUMENT",
    label: "طلبات الوثائق",
    fields: [{ name: "purpose", label: "تفاصيل الطلب", kind: "textarea", required: true }],
  },
  {
    code: "RESIDENCY",
    label: "طلبات الإقامة",
    fields: [{ name: "purpose", label: "تفاصيل الطلب", kind: "textarea", required: true }],
  },
];

export function getRequestTypeConfig(code: string) {
  return REQUEST_TYPE_CONFIG.find((item) => item.code === code);
}
