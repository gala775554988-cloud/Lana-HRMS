import { prisma } from "@/lib/prisma";
import { memoryCache, clearMemoryCache } from "@/lib/cache/memory-cache";

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
    clearMemoryCache(`setting:${key}`);
    
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

async function getCompanyLogoUncached(): Promise<string | null> {
  const setting = await getAppSetting("company.logo");
  if (setting && typeof setting === "object" && setting !== null) {
    const obj = setting as Record<string, unknown>;
    if (typeof obj.url === "string") {
      return obj.url;
    }
  }
  if (typeof setting === "string") return setting;
  return null;
}

export async function getCompanyLogo(): Promise<string | null> {
  return memoryCache("setting:company.logo", 5 * 60 * 1000, getCompanyLogoUncached);
}

export async function setCompanyLogo(url: string) {
  return setAppSetting("company.logo", { url }, "Company logo URL");
}

function boolSetting(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value && typeof value === "object" && "value" in value) {
    const inner = (value as Record<string, unknown>).value;
    if (typeof inner === "boolean") return inner;
  }
  return fallback;
}

async function isOdooIntegrationEnabledUncached(): Promise<boolean> {
  const setting = await getAppSetting("integration.odoo.enabled");
  return boolSetting(setting, true);
}

export async function isOdooIntegrationEnabled(): Promise<boolean> {
  return memoryCache("setting:integration.odoo.enabled", 60 * 1000, isOdooIntegrationEnabledUncached);
}
