import ar from "@/messages/ar.json";
import en from "@/messages/en.json";
import { normalizeLocale, type Locale } from "@/lib/i18n";

export const localeMessages = { ar, en } as const;

export type RuntimeMessages = (typeof localeMessages)[Locale];

export function getRuntimeMessages(locale: string | null | undefined): RuntimeMessages {
  return localeMessages[normalizeLocale(locale)];
}

export function translateText(value: string, locale: Locale): string {
  const dictionary = localeMessages[locale].text as Record<string, string>;
  return dictionary[value] ?? value;
}
