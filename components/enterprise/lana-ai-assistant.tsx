"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Bot, Send, Sparkles, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  results?: Array<Record<string, unknown>>;
};

export function LanaAiAssistant() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "مرحباً، أنا Lana AI. اسألني عن الموارد البشرية أو ابحث داخل البيانات المصرح لك برؤيتها." }
  ]);
  const [isPending, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  if (status !== "authenticated" || !session?.user) return null;

  function send() {
    const message = input.trim();
    if (!message || isPending) return;
    setInput("");
    setMessages((current) => [...current, { role: "user", content: message }]);
    startTransition(async () => {
      try {
        const response = await fetch("/api/enterprise/lana-ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message })
        });
        const data = await response.json().catch(() => ({ success: false, message: "تعذر قراءة رد Lana AI" }));
        if (!response.ok || !data.success) {
          setMessages((current) => [...current, { role: "assistant", content: data.message || "تعذر تنفيذ الطلب." }]);
          return;
        }
        setMessages((current) => [...current, { role: "assistant", content: data.answer, results: data.results }]);
      } catch (error) {
        setMessages((current) => [...current, { role: "assistant", content: error instanceof Error ? error.message : "حدث خطأ غير متوقع." }]);
      }
    });
  }

  return (
    <div className="fixed bottom-5 left-5 z-[70] print:hidden" dir="rtl">
      {open ? (
        <div className="mb-3 w-[min(92vw,420px)] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-primary/20 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between border-b bg-gradient-to-l from-primary to-primary/60 p-4 text-primary-foreground">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/15"><Bot className="h-5 w-5" /></div>
              <div>
                <p className="font-black">Lana AI</p>
                <p className="text-xs text-white/75">مساعد ذكي آمن حسب صلاحياتك</p>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-xl p-2 hover:bg-white/10" aria-label="Close Lana AI"><X className="h-4 w-4" /></button>
          </div>
          <div ref={listRef} className="max-h-[420px] space-y-3 overflow-y-auto bg-muted p-4">
            {messages.map((message, index) => (
              <div key={index} className={message.role === "user" ? "text-left" : "text-right"}>
                <div className={`inline-block max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "bg-primary text-primary-foreground" : "border bg-white text-slate-800 dark:bg-slate-950 dark:text-slate-100"}`}>
                  {message.content}
                  {message.results?.length ? (
                    <div className="mt-3 space-y-2">
                      {message.results.map((result, itemIndex) => {
                        const isProfile = result.type === "employee-profile";
                        const photoUrl = typeof result.photoUrl === "string" ? result.photoUrl : null;
                        const entries = Object.entries(result).filter(([key]) => !["type", "photoUrl", "id"].includes(key));
                        return (
                          <div key={itemIndex} className="rounded-xl border bg-slate-50 p-2 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                            {photoUrl ? (
                              <img src={photoUrl} alt={String(result.name ?? "")} className="mb-2 h-16 w-16 rounded-lg object-cover" />
                            ) : null}
                            {(isProfile ? entries : entries.slice(0, 5)).map(([key, value]) => <div key={key}><strong>{key}:</strong> {String(value ?? "-")}</div>)}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 border-t bg-white p-3 dark:bg-slate-950">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") send(); }}
              placeholder="اسأل Lana AI..."
              className="h-11 flex-1 rounded-2xl border bg-background px-4 text-sm outline-none focus:border-primary"
            />
            <Button type="button" onClick={send} disabled={isPending} className="rounded-2xl bg-primary hover:bg-primary/90"><Send className="h-4 w-4" /></Button>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-2xl shadow-primary/30 transition hover:scale-105"
        aria-label="Open Lana AI"
      >
        <Sparkles className="h-6 w-6" />
      </button>
    </div>
  );
}
