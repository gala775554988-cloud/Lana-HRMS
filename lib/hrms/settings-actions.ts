"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";

export async function getSettingsData(modelName: string, search: string = "") {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  try {
    let records = [];
    
    // First handle Prisma models
    if (modelName === "Nationality") {
      records = await prisma.nationality.findMany({
        where: search ? { name: { contains: search, mode: "insensitive" } } : {},
        orderBy: { name: "asc" }
      });
    } else if (modelName === "EmploymentType") {
      records = await prisma.employmentType.findMany({
        where: search ? { name: { contains: search, mode: "insensitive" } } : {},
        orderBy: { name: "asc" }
      });
    } else if (modelName === "Department") {
      records = await prisma.department.findMany({
        where: search ? { name: { contains: search, mode: "insensitive" } } : {},
        orderBy: { name: "asc" }
      });
    } else if (modelName === "Branch") {
      records = await prisma.branch.findMany({
        where: search ? { name: { contains: search, mode: "insensitive" } } : {},
        orderBy: { name: "asc" }
      });
    } else if (modelName === "Hospital") {
      records = await prisma.hospital.findMany({
        where: search ? { name: { contains: search, mode: "insensitive" } } : {},
        orderBy: { name: "asc" }
      });
    } else if (modelName === "Position") {
      records = await prisma.position.findMany({
        where: search ? { title: { contains: search, mode: "insensitive" } } : {},
        orderBy: { title: "asc" }
      });
    } else if (modelName === "DynamicField") {
      records = await prisma.dynamicField.findMany({
        where: search ? { fieldName: { contains: search, mode: "insensitive" } } : {},
        orderBy: { fieldName: "asc" }
      });
    } else {
      // Fallback to AppSetting for JSON lists (e.g. EmployeeStatus, Qualifications, Religion, Gender, etc.)
      const setting = await prisma.appSetting.findUnique({ where: { key: `LIST_${modelName}` } });
      if (setting && Array.isArray(setting.value)) {
        records = setting.value as any[];
        if (search) {
          records = records.filter(r => r.name?.toLowerCase().includes(search.toLowerCase()));
        }
      }
    }
    
    // Map data uniformly
    return records.map((r: any) => ({
      id: r.id || r.code || Math.random().toString(),
      name: r.name || r.title || r.fieldName || r.key || "Unnamed",
      code: r.code || r.module || "-",
      isActive: r.isActive ?? true,
      original: r
    }));
  } catch (e: any) {
    console.error("[Settings Fetch Error]", e);
    return [];
  }
}

export async function saveSettingData(modelName: string, data: any) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  
  // Enforce Permissions (generic settings manage permission check can be added here)
  const perms = session.user.permissions as string[];
  if (!perms.includes("manage:settings") && !perms.includes("SUPER_ADMIN")) {
    // Just simple fallback allow if SUPER_ADMIN
    const roles = session.user.roles as string[];
    if (!roles.includes("SUPER_ADMIN") && !roles.includes("HR_MANAGER")) {
       throw new Error("Forbidden: Missing permissions to manage settings");
    }
  }

  const isUpdate = !!data.id && data.id !== "new";
  let result;

  try {
    if (modelName === "Nationality") {
      if (isUpdate) result = await prisma.nationality.update({ where: { id: data.id }, data: { name: data.name, code: data.code, isActive: data.isActive } });
      else result = await prisma.nationality.create({ data: { name: data.name, code: data.code, isActive: data.isActive } });
    } else if (modelName === "EmploymentType") {
      if (isUpdate) result = await prisma.employmentType.update({ where: { id: data.id }, data: { name: data.name, code: data.code, isActive: data.isActive } });
      else result = await prisma.employmentType.create({ data: { name: data.name, code: data.code, isActive: data.isActive } });
    } else if (modelName === "Department") {
      if (isUpdate) result = await prisma.department.update({ where: { id: data.id }, data: { name: data.name, code: data.code, isActive: data.isActive } });
      else result = await prisma.department.create({ data: { name: data.name, code: data.code, isActive: data.isActive } });
    } else if (modelName === "Branch") {
      if (isUpdate) result = await prisma.branch.update({ where: { id: data.id }, data: { name: data.name, code: data.code, isActive: data.isActive } });
      else result = await prisma.branch.create({ data: { name: data.name, code: data.code, isActive: data.isActive } });
    } else if (modelName === "Hospital") {
      if (isUpdate) result = await prisma.hospital.update({ where: { id: data.id }, data: { name: data.name, code: data.code, isActive: data.isActive } });
      else result = await prisma.hospital.create({ data: { name: data.name, code: data.code, isActive: data.isActive } });
    } else if (modelName === "Position") {
      if (isUpdate) result = await prisma.position.update({ where: { id: data.id }, data: { title: data.name, code: data.code, isActive: data.isActive } });
      else result = await prisma.position.create({ data: { title: data.name, code: data.code, isActive: data.isActive } });
    } else if (modelName === "DynamicField") {
      if (isUpdate) result = await prisma.dynamicField.update({ where: { id: data.id }, data: { fieldName: data.name, module: data.code, fieldType: "TEXT", isActive: data.isActive } });
      else result = await prisma.dynamicField.create({ data: { fieldName: data.name, module: data.code, fieldType: "TEXT", isActive: data.isActive } });
    } else {
      // JSON Array handling
      const settingKey = `LIST_${modelName}`;
      const setting = await prisma.appSetting.findUnique({ where: { key: settingKey } });
      let arr = setting && Array.isArray(setting.value) ? setting.value as any[] : [];
      
      if (isUpdate) {
        arr = arr.map(item => item.id === data.id ? { ...item, name: data.name, code: data.code, isActive: data.isActive } : item);
      } else {
        arr.push({ id: Math.random().toString(36).substr(2, 9), name: data.name, code: data.code, isActive: data.isActive });
      }

      result = await prisma.appSetting.upsert({
        where: { key: settingKey },
        update: { value: arr },
        create: { key: settingKey, value: arr, description: `Settings array for ${modelName}` }
      });
    }

    await writeAuditLog({ actorUserId: session.user.id, action: isUpdate ? "UPDATE" : "CREATE", entity: `Settings:${modelName}`, entityId: result?.id || "json-list", metadata: { name: data.name } });
    revalidatePath(`/[module]/settings`, "page");
    return { success: true };
  } catch (e: any) {
    console.error("[Settings Save Error]", e);
    return { success: false, error: e.message };
  }
}

export async function deleteSettingData(modelName: string, id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  
  try {
    if (modelName === "Nationality") await prisma.nationality.delete({ where: { id } });
    else if (modelName === "EmploymentType") await prisma.employmentType.delete({ where: { id } });
    else if (modelName === "Department") await prisma.department.delete({ where: { id } });
    else if (modelName === "Branch") await prisma.branch.delete({ where: { id } });
    else if (modelName === "Hospital") await prisma.hospital.delete({ where: { id } });
    else if (modelName === "Position") await prisma.position.delete({ where: { id } });
    else if (modelName === "DynamicField") await prisma.dynamicField.delete({ where: { id } });
    else {
      const settingKey = `LIST_${modelName}`;
      const setting = await prisma.appSetting.findUnique({ where: { key: settingKey } });
      if (setting && Array.isArray(setting.value)) {
        const arr = (setting.value as any[]).filter(item => item.id !== id);
        await prisma.appSetting.update({ where: { key: settingKey }, data: { value: arr } });
      }
    }
    
    await writeAuditLog({ actorUserId: session.user.id, action: "DELETE", entity: `Settings:${modelName}`, entityId: id, metadata: {} });
    revalidatePath(`/[module]/settings`, "page");
    return { success: true };
  } catch (e: any) {
    console.error("[Settings Delete Error]", e);
    return { success: false, error: e.message };
  }
}
