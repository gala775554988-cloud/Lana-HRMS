/** Client-facing activity summaries deliberately exclude raw metadata and device/IP identifiers. */
export function presentEmployeeActivity(action: string, metadata: unknown) {
  if (action === "auth:device_binding_blocked")
    return {
      title: "محاولة دخول ضمن سياسة الأجهزة السابقة",
      description:
        "حدث تاريخي محفوظ للمراجعة؛ لم يعد ارتباط الجهاز شرطاً للدخول.",
      tone: "neutral",
    };
  if (action === "PASSWORD_RESET")
    return {
      title: "إعادة تعيين كلمة المرور",
      description: "تم تحديث بيانات الدخول بواسطة مستخدم مخوّل.",
      tone: "security",
    };
  if (action === "employee:account_updated") {
    const labels: Record<string, string> = {
      email: "بريد الدخول",
      username: "اسم المستخدم",
      password: "كلمة المرور",
      isActive: "حالة الحساب",
      issueActivation: "رمز التفعيل",
      clearLoginEmail: "إعادة تسجيل البريد",
      restoreIdentityPassword: "طريقة الدخول",
    };
    const fields =
      metadata &&
      typeof metadata === "object" &&
      "fields" in metadata &&
      Array.isArray(metadata.fields)
        ? metadata.fields
            .filter(
              (field): field is string =>
                typeof field === "string" && Object.hasOwn(labels, field),
            )
            .map((field) => labels[field])
        : [];
    return {
      title: "تحديث حساب الموظف",
      description: fields.length
        ? `تم تحديث: ${fields.join("، ")}.`
        : "تمت مراجعة إعدادات الحساب وبيانات الدخول.",
      tone: "security",
    };
  }
  if (/document|upload|attachment/i.test(action))
    return {
      title: "تحديث مستندات الموظف",
      description: "تم إجراء تغيير على الملفات والمرفقات.",
      tone: "document",
    };
  if (/salary|payroll/i.test(action))
    return {
      title: "تحديث بيانات الرواتب",
      description: "تم تسجيل إجراء متعلق بالبيانات المالية.",
      tone: "finance",
    };
  if (/archive/i.test(action))
    return {
      title: "تحديث حالة الموظف",
      description: "تم تعديل حالة الملف الوظيفي.",
      tone: "neutral",
    };
  return {
    title: "تحديث ملف الموظف",
    description: "تم تسجيل إجراء على الملف بواسطة مستخدم مخوّل.",
    tone: "neutral",
  };
}
