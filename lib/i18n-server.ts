import { cookies, headers } from "next/headers";
import { getDictionary, normalizeLocale, type Locale } from "@/lib/i18n";

export async function getRequestLocale(): Promise<Locale> {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const headerLocale = requestHeaders.get("x-lana-locale");
  const cookieLocale = cookieStore.get("lana-locale")?.value;

  return normalizeLocale(headerLocale ?? cookieLocale);
}

export async function getRequestDictionary() {
  const locale = await getRequestLocale();
  return { locale, dictionary: getDictionary(locale) };
}
