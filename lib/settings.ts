import { prisma } from "@/lib/prisma";

export async function getAppSetting(key: string, defaultValue: unknown = null) {
  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key }
    });
    if (!setting) return defaultValue;
    return setting.value;
  } catch {
    return defaultValue;
  }
}

export async function setAppSetting(key: string, value: unknown, description?: string) {
  try {
    const jsonValue = typeof value === 'object' && value !== null ? value : { value };
    
    return await prisma.appSetting.upsert({
      where: { key },
      update: { 
        value: jsonValue,
        ...(description && { description })
      },
      create: { 
        key, 
        value: jsonValue,
        description: description || key 
      }
    });
  } catch (error) {
    console.error("Failed to set app setting", key, error);
    return null;
  }
}

export async function getCompanyLogo(): Promise<string | null> {
  const setting = await getAppSetting("company.logo");
  if (setting && typeof setting === "object" && setting.url) {
    return setting.url;
  }
  if (typeof setting === "string") return setting;
  return null;
}

export async function setCompanyLogo(url: string) {
  return setAppSetting("company.logo", { url }, "Company logo URL");
}
