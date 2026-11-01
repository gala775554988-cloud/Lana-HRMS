import { prisma } from "@/lib/prisma";
export type StageInput = { order: number; name: string | null; approverEmployeeId: string; isMandatory: boolean };
export function validateStages(input: unknown): StageInput[] {
  if (!Array.isArray(input) || !input.length || input.length > 100) throw new Error("أضف من مرحلة إلى 100 مرحلة للمسار.");
  const seen = new Set<string>();
  const stages = input.map((raw, index) => {
    if (!raw || typeof raw !== "object" || typeof raw.approverEmployeeId !== "string" || !raw.approverEmployeeId.trim()) throw new Error(`اختر المعتمد للمرحلة ${index + 1}.`);
    const id = raw.approverEmployeeId.trim();
    if (seen.has(id)) throw new Error("لا يمكن تكرار المعتمد نفسه في المسار.");
    seen.add(id);
    return { order: index + 1, name: typeof raw.name === "string" ? raw.name.trim().slice(0, 100) || null : null, approverEmployeeId: id, isMandatory: raw.isMandatory !== false };
  });
  if (!stages.some(stage => stage.isMandatory)) throw new Error("يلزم وجود مرحلة اعتماد إلزامية واحدة على الأقل؛ الاطلاع وحده لا يُعد اعتماداً.");
  return stages;
}
export async function validateActiveApprovers(stages: { approverEmployeeId: string }[]) {
  const ids = [...new Set(stages.map(stage => stage.approverEmployeeId))];
  const count = await prisma.employee.count({ where: { id: { in: ids }, status: { notIn: ["INACTIVE", "TERMINATED"] }, user: { is: { isActive: true } } } });
  if (count !== ids.length) throw new Error("كل معتمد يجب أن يكون موظفاً نشطاً مرتبطاً بحساب دخول نشط.");
}
