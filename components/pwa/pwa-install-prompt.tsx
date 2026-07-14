"use client";

import { useEffect, useMemo, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISSED_KEY = "lana-pwa-install-dismissed";
const INSTALL_PROMPT_EVENT = "beforeinstallprompt";

function isStandaloneDisplayMode() {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    // iOS Safari exposes navigator.standalone when opened from Home Screen.
    ("standalone" in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const iosDevice = useMemo(() => isIOS(), []);

  useEffect(() => {
    if (isStandaloneDisplayMode()) return;
    if (window.localStorage.getItem(DISMISSED_KEY) === "true") return;

    if (iosDevice) {
      const timer = window.setTimeout(() => {
        setShowIOSHelp(true);
        setIsVisible(true);
      }, 1200);
      return () => window.clearTimeout(timer);
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    window.addEventListener(INSTALL_PROMPT_EVENT, onBeforeInstallPrompt);
    return () => window.removeEventListener(INSTALL_PROMPT_EVENT, onBeforeInstallPrompt);
  }, [iosDevice]);

  useEffect(() => {
    const onUpdateReady = () => setUpdateAvailable(true);
    window.addEventListener("lana-pwa-update-ready", onUpdateReady);
    return () => window.removeEventListener("lana-pwa-update-ready", onUpdateReady);
  }, []);

  const applyUpdate = () => {
    window.location.reload();
  };

  const installApp = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setIsVisible(false);
    }
    setDeferredPrompt(null);
  };

  const dismiss = () => {
    window.localStorage.setItem(DISMISSED_KEY, "true");
    setIsVisible(false);
  };

  if (updateAvailable) {
    return (
      <div className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-md rounded-2xl border border-primary/30 bg-white/95 p-4 text-slate-900 shadow-2xl backdrop-blur dark:border-primary/40 dark:bg-slate-950/95 dark:text-slate-50">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-primary/15">
            <img src="/brand/lana-logo.png" alt="شعار Lana HRMS" className="h-full w-full object-contain p-1" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">تحديث جديد متاح</p>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
              يوجد إصدار أحدث من النظام. اضغط "تحديث الآن" لإعادة تحميل الصفحة والحصول على آخر الإصلاحات.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={applyUpdate}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
              >
                تحديث الآن
              </button>
              <button
                type="button"
                onClick={() => setUpdateAvailable(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-900"
              >
                لاحقًا
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isVisible || isStandaloneDisplayMode()) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-md rounded-2xl border border-slate-200 bg-white/95 p-4 text-slate-900 shadow-2xl backdrop-blur dark:border-slate-700 dark:bg-slate-950/95 dark:text-slate-50">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-indigo-500/15">
          <img src="/brand/lana-logo.png" alt="شعار Lana HRMS" className="h-full w-full object-contain p-1" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">ثبّت Lana HRMS كتطبيق</p>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
            {showIOSHelp
              ? "على الآيفون/الآيباد: اضغط زر المشاركة ثم اختر \"إضافة إلى الشاشة الرئيسية\"."
              : "افتح النظام بسرعة من الشاشة الرئيسية مع تجربة تشبه تطبيقات الجوال."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {!showIOSHelp && deferredPrompt ? (
              <button
                type="button"
                onClick={installApp}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                تثبيت التطبيق
              </button>
            ) : null}
            <button
              type="button"
              onClick={dismiss}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-900"
            >
              لاحقًا
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
