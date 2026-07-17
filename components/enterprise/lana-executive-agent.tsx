"use client";

import React, { useState, useRef, useEffect } from "react";
import { useChat } from "ai/react";
import { Sparkles, Send, Minus, Maximize2, ShieldCheck, CheckCircle2, RefreshCw, Zap, Bot, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function LanaExecutiveAgent() {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading, setInput, append } = useChat({
    api: "/api/lana/executive-actions"
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!isMinimized) {
      scrollToBottom();
    }
  }, [messages, isMinimized]);

  const suggestions = [
    "اعتمد جميع طلبات مستشفى لانا المعلقة",
    "اعرض إحصائيات القوى العاملة والحضور لليوم",
    "تشغيل مزامنة أودو الذكية للموظفين والمرفقات"
  ];

  if (isMinimized) {
    return (
      <div
        onClick={() => setIsMinimized(false)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="fixed bottom-6 right-6 z-[9999] flex items-center gap-3 rounded-full bg-gradient-to-r from-indigo-600 via-purple-600 to-teal-600 p-3.5 pe-5 text-white shadow-2xl transition-all duration-300 hover:scale-105 cursor-pointer ring-4 ring-white/20 dark:ring-slate-800/40"
        dir="rtl"
      >
        <span className="relative flex h-3.5 w-3.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-teal-500" />
        </span>
        <span className="font-black text-sm tracking-tight flex items-center gap-1.5">
          <span>👑 لانا التنفيذية (Executive AI)</span>
        </span>
        <ChevronUp className="h-4 w-4 text-amber-300" />
      </div>
    );
  }

  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] w-96 sm:w-[420px] rounded-3xl bg-white/95 dark:bg-slate-900/95 shadow-2xl border border-slate-200/80 dark:border-slate-800 backdrop-blur-xl overflow-hidden flex flex-col transition-all duration-300 animate-in fade-in slide-in-from-bottom-5"
      dir="rtl"
    >
      {/* Header Bar */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-teal-600 p-4 text-white font-bold flex items-center justify-between shadow-md select-none">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-teal-500" />
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-black tracking-tight">👑 لانا التنفيذية</span>
              <Badge className="bg-amber-400/20 text-amber-300 border-amber-400/30 px-2 py-0.2 text-[9px] font-mono">
                Executive Agent
              </Badge>
            </div>
            <p className="text-[10px] text-white/80 font-light mt-0.5">
              مركز الأتمتة المباشر للمفوضين والقيادات العليـا
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="rounded-xl p-1.5 text-white/80 hover:bg-white/15 hover:text-white transition"
            title="تصغير المساعد"
          >
            <Minus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages Window */}
      <div className="h-80 overflow-y-auto p-4 space-y-3 bg-slate-50/50 dark:bg-slate-950/40">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4 space-y-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 shadow-sm">
              <Zap className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">أهلاً بك في غرفة القيادة لانا التنفيذية</h4>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                بصفتك صاحب صلاحية تنفيذية (👑)، يمكنك إصدار أوامر الأتمتة الفورية لاعتماد كافة طلبات المستشفيات المعلقة أو تنفيذ الاستعلامات الحية بنقرة واحدة.
              </p>
            </div>

            <div className="grid w-full gap-1.5 pt-2">
              {suggestions.map((sug, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => append({ role: "user", content: sug })}
                  className="rounded-xl border border-slate-200/80 bg-white p-2.5 text-xs font-semibold text-slate-700 hover:border-indigo-500 hover:bg-indigo-50/40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-600 text-start transition shadow-2xs"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col gap-1.5 ${
                m.role === "user" ? "items-end ms-8" : "items-start me-8"
              }`}
            >
              <div
                className={`rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-sm ${
                  m.role === "user"
                    ? "bg-indigo-600 text-white rounded-br-none font-semibold"
                    : "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-bl-none border border-slate-200/80 dark:border-slate-800 font-medium whitespace-pre-wrap"
                }`}
              >
                {m.role === "assistant" && (
                  <div className="flex items-center gap-1.5 text-[10px] font-black text-indigo-600 dark:text-indigo-400 mb-1.5 border-b border-slate-100 dark:border-slate-800 pb-1">
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    <span>👑 استجابة لانا التنفيذية</span>
                  </div>
                )}
                {m.content}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex items-center gap-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 px-4 py-3 text-xs font-semibold text-indigo-600 dark:text-indigo-400 me-12 animate-pulse shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-teal-500 animate-ping" />
            <span>جاري تنفيذ الأمر والتنسيق مع خادم Neon...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 flex items-center gap-2">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="مثلاً: اعتمد جميع طلبات مستشفى لانا..."
          className="flex-1 rounded-2xl border border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950 px-3.5 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition"
        />
        <Button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="h-10 w-10 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shrink-0 flex items-center justify-center p-0"
        >
          <Send className="h-4 w-4 rtl:rotate-180" />
        </Button>
      </form>

      {/* Footer bar */}
      <div className="bg-slate-50 dark:bg-slate-950/80 px-4 py-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[9px] text-muted-foreground font-mono">
        <span>RBAC Protected</span>
        <span className="text-teal-600 dark:text-teal-400 font-bold">100% Executive Verified</span>
      </div>
    </div>
  );
}
