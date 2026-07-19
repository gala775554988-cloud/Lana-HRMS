"use client";

import React, { useState } from "react";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { Fingerprint, ShieldCheck, Smartphone, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function WebAuthnDeviceBindingWidget({
  mode = "register",
  identifier = "",
  onAuthenticated
}: {
  mode?: "register" | "authenticate";
  identifier?: string;
  onAuthenticated?: (user: any) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleRegisterBiometric = async () => {
    setLoading(true);
    setMsg(null);
    setIsSuccess(false);
    try {
      // 1. Get registration options from server
      const optRes = await fetch("/api/auth/webauthn/register-options", { method: "POST" });
      const optData = await optRes.json();
      if (!optRes.ok || !optData.success) {
        throw new Error(optData.message || "فشل الحصول على خيارات التحقق البيومتري من الخادم");
      }

      // 2. Trigger browser hardware prompt (Face ID / Fingerprint / Windows Hello)
      let attResp;
      try {
        attResp = await startRegistration({ optionsJSON: optData.options });
      } catch (browserErr: any) {
        if (browserErr?.name === "NotAllowedError") {
          throw new Error("تم إلغاء أو رفض المصادقة البيومترية من قبل المستخدم أو الجهاز");
        }
        throw new Error(browserErr?.message || "فشل التخاطب مع حساس البصمة في الجهاز");
      }

      // 3. Verify hardware signature on server & store in BiometricCredential
      const verRes = await fetch("/api/auth/webauthn/register-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response: attResp,
          deviceName: `${navigator.userAgent?.split(") ")[0]?.split(" (")[1] || "Secure Hardware"} (WebAuthn PWA)`
        })
      });
      const verData = await verRes.json();
      if (!verRes.ok || !verData.success) {
        throw new Error(verData.message || "فشل التحقق من المفتاح العام للجهاز");
      }

      setIsSuccess(true);
      setMsg(verData.message || "✓ تم ربط حسابك ببصمة هذا الجهاز ومفتاحه المشفر بنجاح!");
    } catch (err: any) {
      setIsSuccess(false);
      setMsg(err.message || "حدث خطأ غير متوقع أثناء ربط بصمة الجهاز");
    } finally {
      setLoading(false);
    }
  };

  const handleAuthenticateBiometric = async () => {
    setLoading(true);
    setMsg(null);
    setIsSuccess(false);
    try {
      // 1. Get auth challenge from server
      const optRes = await fetch("/api/auth/webauthn/auth-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier })
      });
      const optData = await optRes.json();
      if (!optRes.ok || !optData.success) {
        throw new Error(optData.message || "فشل تجهيز تحدي البصمة البيومترية");
      }

      // 2. Trigger device biometric signature
      let asseResp;
      try {
        asseResp = await startAuthentication({ optionsJSON: optData.options });
      } catch (browserErr: any) {
        throw new Error(browserErr?.message || "فشل قراءة بصمة الجهاز أو إلغاء العملية");
      }

      // 3. Verify against BiometricCredential public key
      const verRes = await fetch("/api/auth/webauthn/auth-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response: asseResp,
          deviceName: `${navigator.userAgent?.split(") ")[0]?.split(" (")[1] || "Hardware Device"}`
        })
      });
      const verData = await verRes.json();
      if (!verRes.ok || !verData.success) {
        throw new Error(verData.message || "فشل التحقق البيومتري من الجهاز");
      }

      setIsSuccess(true);
      setMsg(verData.message || "✓ تم الدخول ببصمة الجهاز بنجاح!");
      if (onAuthenticated && verData.user) {
        onAuthenticated(verData.user);
      }
    } catch (err: any) {
      setIsSuccess(false);
      setMsg(err.message || "فشل الدخول البيومتري");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-3xl border border-primary/25 bg-gradient-to-b from-white via-primary/[0.02] to-slate-50/80 dark:from-slate-900 dark:via-primary/[0.03] dark:to-slate-950 p-6 shadow-lg space-y-4 text-right font-sans" dir="rtl">
      <div className="flex items-center justify-between border-b border-primary/15 pb-3.5">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary shadow-inner">
            <Fingerprint className="h-6 w-6 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>{mode === "register" ? "ربط الحساب ببصمة ومفتاح الجهاز (WebAuthn / Passkey)" : "الدخول الحيوي المباشر ببصمة الجهاز"}</span>
              <Badge className="bg-emerald-600 text-white font-extrabold text-[10px] px-2.5 py-0.5">PWA Hardware Bound</Badge>
            </h3>
            <p className="text-xs font-semibold text-muted-foreground mt-0.5">
              {mode === "register"
                ? "يتم تشفير وربط هويتك بالعتاد الصلب لجهازك (Touch ID / Face ID / Windows Hello) لضمان استمرارية العمل على المتصفح وتطبيق PWA دون قفل أو حظر."
                : "استخدم بصمة وجهك أو إصبعك للدخول الفوري وتخطي قيود الكوكيز وتعدد الأجهزة."}
            </p>
          </div>
        </div>
      </div>

      {msg ? (
        <div className={`p-4 rounded-2xl text-xs font-black flex items-center gap-2.5 transition-all duration-300 animate-in fade-in ${
          isSuccess
            ? "bg-emerald-50 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300"
            : "bg-rose-50 text-rose-900 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-300"
        }`}>
          {isSuccess ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" /> : <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />}
          <span className="leading-relaxed">{msg}</span>
        </div>
      ) : null}

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
        <div className="flex items-center gap-2 text-xs font-extrabold text-slate-600 dark:text-slate-400">
          <ShieldCheck className="h-4.5 w-4.5 text-primary" />
          <span>تشفير فيزيائي FIDO2 مباشر مع معالج الأمان (Secure Enclave / TPM).</span>
        </div>

        <Button
          type="button"
          onClick={mode === "register" ? handleRegisterBiometric : handleAuthenticateBiometric}
          disabled={loading}
          className="w-full sm:w-auto bg-primary text-white hover:bg-primary/90 font-black text-xs h-12 px-7 rounded-2xl shadow-md shadow-primary/20 gap-2 transition"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-5 w-5" />}
          <span>{mode === "register" ? "تفعيل وربط بصمة هذا الجهاز الآن 🔐" : "المصادقة وبدء الجلسة ببصمة الجهاز 🚀"}</span>
        </Button>
      </div>
    </div>
  );
}
