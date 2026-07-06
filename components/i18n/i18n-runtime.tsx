"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { localeMessages } from "@/lib/messages";
import { normalizeLocale, type Locale } from "@/lib/i18n";

const SKIP_SELECTOR = "script,style,code,pre,textarea,[data-no-translate]";
const ATTRIBUTES = ["placeholder", "title", "aria-label", "alt"] as const;

function getCookieLocale(): Locale | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )lana-locale=([^;]+)/);
  return match ? normalizeLocale(decodeURIComponent(match[1])) : null;
}

function getStoredLocale(initialLocale: Locale): Locale {
  if (typeof window === "undefined") return initialLocale;
  return normalizeLocale(window.localStorage.getItem("lana.hrms.locale") ?? getCookieLocale() ?? initialLocale);
}

function preserveWhitespace(original: string, translated: string) {
  const prefix = original.match(/^\s*/)?.[0] ?? "";
  const suffix = original.match(/\s*$/)?.[0] ?? "";
  return `${prefix}${translated}${suffix}`;
}

function shouldSkip(node: Node) {
  const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  return Boolean(element?.closest(SKIP_SELECTOR));
}

function translateExact(value: string, dictionary: Record<string, string>) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) return value;
  const translated = dictionary[compact];
  return translated ? preserveWhitespace(value, translated) : value;
}

function applyTranslations(root: ParentNode, locale: Locale, originalText: WeakMap<Text, string>, originalAttrs: WeakMap<Element, Partial<Record<(typeof ATTRIBUTES)[number], string>>>) {
  const dictionary = localeMessages[locale].text as Record<string, string>;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (shouldSkip(node)) return NodeFilter.FILTER_REJECT;
      const text = node.textContent ?? "";
      return text.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });

  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

  for (const node of textNodes) {
    const original = originalText.get(node) ?? node.textContent ?? "";
    originalText.set(node, original);
    const nextText = translateExact(original, dictionary);
    if (node.textContent !== nextText) node.textContent = nextText;
  }

  const elements = root instanceof Element ? [root, ...Array.from(root.querySelectorAll("*"))] : Array.from(root.querySelectorAll("*"));
  for (const element of elements) {
    if (element.closest(SKIP_SELECTOR)) continue;
    const original = originalAttrs.get(element) ?? {};
    for (const attr of ATTRIBUTES) {
      const current = element.getAttribute(attr);
      if (!current) continue;
      const base = original[attr] ?? current;
      original[attr] = base;
      const nextValue = translateExact(base, dictionary);
      if (current !== nextValue) element.setAttribute(attr, nextValue);
    }
    originalAttrs.set(element, original);
  }
}

export function I18nRuntime({ initialLocale }: { initialLocale: Locale }) {
  const [locale, setLocale] = useState<Locale>(() => initialLocale);
  const originalText = useRef(new WeakMap<Text, string>());
  const originalAttrs = useRef(new WeakMap<Element, Partial<Record<(typeof ATTRIBUTES)[number], string>>>());
  const resolvedLocale = useMemo(() => localeMessages[locale], [locale]);

  useEffect(() => {
    const activeLocale = getStoredLocale(initialLocale);
    setLocale(activeLocale);
  }, [initialLocale]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = resolvedLocale.dir;
    document.documentElement.dataset.locale = locale;
    document.body.dataset.locale = locale;
    document.body.style.fontFamily = locale === "ar"
      ? "'Noto Sans Arabic', 'Inter', system-ui, -apple-system, sans-serif"
      : "'Inter', 'Noto Sans Arabic', system-ui, -apple-system, sans-serif";

    applyTranslations(document.body, locale, originalText.current, originalAttrs.current);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
              const root = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
              if (root) applyTranslations(root, locale, originalText.current, originalAttrs.current);
            }
          });
        }
        if (mutation.type === "characterData" && mutation.target.nodeType === Node.TEXT_NODE) {
          const textNode = mutation.target as Text;
          if (!originalText.current.has(textNode)) {
            originalText.current.set(textNode, textNode.textContent ?? "");
          }
          const parent = textNode.parentElement;
          if (parent) applyTranslations(parent, locale, originalText.current, originalAttrs.current);
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    const onLocaleChange = (event: Event) => {
      const next = normalizeLocale((event as CustomEvent<{ locale: Locale }>).detail?.locale);
      setLocale(next);
    };
    window.addEventListener("lana-locale-change", onLocaleChange);
    window.addEventListener("storage", () => setLocale(getStoredLocale(locale)));

    return () => {
      observer.disconnect();
      window.removeEventListener("lana-locale-change", onLocaleChange);
    };
  }, [locale, resolvedLocale.dir, initialLocale]);

  return null;
}
