"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Download, Smartphone, Share2, PlusSquare, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandaloneDisplayMode() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    ("standalone" in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

interface InstallButtonProps {
  className?: string;
  label?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function InstallButton({
  className = "bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl shadow-lg gap-2",
  label = 'تثبيت "لانا" الآن',
  variant = "default",
  size = "default"
}: InstallButtonProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showGuideModal, setShowIOSHelpModal] = useState(false);
  const iosDevice = useMemo(() => isIOS(), []);

  useEffect(() => {
    if (isStandaloneDisplayMode()) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  const handleInstall = async () => {
    if (isInstalled) return;

    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      // Show rich visual instruction guide modal for iOS or unsupported auto-prompt browsers
      setShowIOSHelpModal(true);
    }
  };

  if (isInstalled) {
    return (
      <Button
        type="button"
        disabled
        variant="secondary"
        size={size}
        className="rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold gap-2 opacity-90"
        dir="rtl"
      >
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        <span>مثبّت على جهازك</span>
      </Button>
    );
  }

  return (
    <>
      <Button
        type="button"
        onClick={handleInstall}
        variant={variant}
        size={size}
        className={className}
        dir="rtl"
      >
        <Download className="h-4 w-4" />
        <span>{label}</span>
      </Button>

      <Dialog open={showGuideModal} onOpenChange={setShowIOSHelpModal}>
        <DialogContent className="max-w-md rounded-3xl p-6 text-slate-900 dark:text-slate-100" dir="rtl">
          <DialogHeader className="text-start space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center shadow-xs">
                <Smartphone className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  خطوات تثبيت تطبيق "لانا" على جهازك
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground font-mono mt-0.5">
                  {iosDevice ? "iOS Safari Installation Guide" : "Manual PWA Setup Instructions"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-3">
            {iosDevice ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
                  <div className="h-7 w-7 rounded-xl bg-teal-600 text-white font-black text-xs flex items-center justify-center shrink-0">1</div>
                  <div className="text-xs leading-relaxed">
                    <span className="font-bold text-slate-900 dark:text-slate-100">اضغط على زر المشاركة (Share):</span>
                    <p className="text-muted-foreground mt-0.5">
                      موجود في أسفل أو أعلى شاشة المتصفح Safari على شكل مربع يخرج منه سهم للأعلى.
                    </p>
                    <div className="mt-2 inline-flex items-center gap-1 rounded-lg bg-white dark:bg-slate-800 border px-2.5 py-1 text-[11px] font-bold text-teal-600 dark:text-teal-400 shadow-2xs">
                      <Share2 className="h-3.5 w-3.5" />
                      <span>زر المشاركة</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
                  <div className="h-7 w-7 rounded-xl bg-teal-600 text-white font-black text-xs flex items-center justify-center shrink-0">2</div>
                  <div className="text-xs leading-relaxed">
                    <span className="font-bold text-slate-900 dark:text-slate-100">اختر "إضافة إلى الشاشة الرئيسية":</span>
                    <p className="text-muted-foreground mt-0.5">
                      مرر في قائمة الخيارات لأسفل واضغط على الخيار الذي يحتوي على علامة المربع والزائد.
                    </p>
                    <div className="mt-2 inline-flex items-center gap-1 rounded-lg bg-white dark:bg-slate-800 border px-2.5 py-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 shadow-2xs">
                      <PlusSquare className="h-3.5 w-3.5" />
                      <span>إضافة إلى الشاشة الرئيسية (Add to Home Screen)</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
                  <div className="h-7 w-7 rounded-xl bg-teal-600 text-white font-black text-xs flex items-center justify-center shrink-0">3</div>
                  <div className="text-xs leading-relaxed">
                    <span className="font-bold text-slate-900 dark:text-slate-100">اضغط "إضافة (Add)":</span>
                    <p className="text-muted-foreground mt-0.5">
                      في الزاوية العلوية اليمنى/اليسرى لتأكيد التثبيت. سيظهر لك أيقونة لانا الدائرية الموحدة على شاشة الآيفون مباشرة.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 p-4 text-xs text-muted-foreground dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
                <p className="font-bold text-slate-900 dark:text-slate-100">لتثبيت التطبيق على متصفح Chrome أو Edge:</p>
                <p>
                  اضغط على خيارات المتصفح (النقاط الثلاث علوي الشاشة) ثم اختر <b>&quot;تثبيت Lana HRMS (Install App)&quot;</b> ليتم فتح النظام في نافذة تطبيق منفصلة وسريعة.
                </p>
              </div>
            )}
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              type="button"
              onClick={() => setShowIOSHelpModal(false)}
              className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-teal-600 dark:hover:bg-teal-700 font-bold px-6"
            >
              فهمت ذلك
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
