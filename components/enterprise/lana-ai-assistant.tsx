"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Bot, Send, Sparkles, X, Plus, Copy, Check, RefreshCw, Square, 
  Paperclip, FileText, Image as ImageIcon, FileSpreadsheet, Maximize2, Minimize2, ArrowDown
} from "lucide-react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";

type UploadedFile = {
  name: string;
  type: string;
  size: number;
  dataUri: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  files?: UploadedFile[];
  isStreaming?: boolean;
};

function LanaMarkdownRenderer({ content }: { content: string }) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  function copyCode(code: string, idx: number) {
    navigator.clipboard.writeText(code);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  // Split into code blocks vs regular text
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2.5 text-sm leading-relaxed">
      {parts.map((part, idx) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const lines = part.slice(3, -3).trim().split("\n");
          const lang = lines[0]?.match(/^[a-zA-Z0-9_-]+$/) ? lines[0] : "";
          const code = lang ? lines.slice(1).join("\n") : lines.join("\n");

          return (
            <div key={idx} className="my-2 overflow-hidden rounded-xl border border-slate-700 bg-slate-950 text-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-400">
                <span className="font-mono lowercase">{lang || "كود"}</span>
                <button
                  type="button"
                  onClick={() => copyCode(code, idx)}
                  className="flex items-center gap-1.5 rounded px-2 py-0.5 text-xs transition hover:bg-slate-800 hover:text-white"
                >
                  {copiedIndex === idx ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedIndex === idx ? "تم النسخ" : "نسخ الكود"}</span>
                </button>
              </div>
              <pre className="overflow-x-auto p-3 text-xs font-mono leading-normal text-emerald-300">
                <code>{code}</code>
              </pre>
            </div>
          );
        }

        // Format bold, italic, bullet lists
        return (
          <div key={idx} className="whitespace-pre-wrap break-words">
            {part.split("\n").map((line, lIdx) => {
              const trimmed = line.trim();
              if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
                return (
                  <div key={lIdx} className="flex items-start gap-2 ms-2 my-1">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />
                    <span>{trimmed.slice(2)}</span>
                  </div>
                );
              }
              if (/^\d+\.\s/.test(trimmed)) {
                const numMatch = trimmed.match(/^(\d+\.)\s+(.*)/);
                return (
                  <div key={lIdx} className="flex items-start gap-2 ms-2 my-1">
                    <span className="font-bold text-secondary dark:text-secondary/50 shrink-0">{numMatch?.[1]}</span>
                    <span>{numMatch?.[2] || trimmed}</span>
                  </div>
                );
              }
              return (
                <p key={lIdx} className={lIdx > 0 ? "mt-1.5" : ""}>
                  {line}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export function LanaAiAssistant() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [isStreaming, setIsStreaming] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Static UI lockdown: Lana's icon is a fixed, non-draggable element -- any
  // (x, y) coordinates a previous version may have stored while dragging was
  // still enabled are stale and must never be read back.
  useEffect(() => {
    try {
      window.localStorage.removeItem("lana.ai.position");
      window.localStorage.removeItem("lana.executive.position");
      window.sessionStorage.removeItem("lana.ai.position");
      window.sessionStorage.removeItem("lana.executive.position");
    } catch {}
  }, []);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function scrollToBottom(behavior: ScrollBehavior = "smooth") {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }

  useEffect(() => {
    if (open) {
      setTimeout(() => scrollToBottom("auto"), 100);
    }
  }, [open, messages]);

  function handleScroll() {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    setShowScrollBottom(scrollHeight - scrollTop - clientHeight > 120);
  }

  if (status !== "authenticated" || !session?.user) return null;

  async function handleFileUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const newFiles: UploadedFile[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (file.size > 10 * 1024 * 1024) continue; // max 10MB
      const dataUri = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      newFiles.push({
        name: file.name,
        type: file.type,
        size: file.size,
        dataUri
      });
    }
    setFiles((prev) => [...prev, ...newFiles]);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  }

  function startNewChat() {
    if (isStreaming && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setConversationId(undefined);
    setMessages([]);
    setInput("");
    setFiles([]);
    setIsStreaming(false);
  }

  function copyMessage(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 2000);
  }

  function stopGenerating() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
  }

  async function send(customMessage?: string) {
    const textToSend = (customMessage || input).trim();
    if (!textToSend && files.length === 0) return;
    if (isStreaming) return;

    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `assistant-${Date.now()}`;
    const currentFiles = [...files];

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: textToSend, files: currentFiles.length ? currentFiles : undefined },
      { id: assistantMsgId, role: "assistant", content: "", isStreaming: true }
    ]);

    if (!customMessage) {
      setInput("");
      setFiles([]);
    }
    setIsStreaming(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const currentSelectedEmployeeId = typeof window !== "undefined" ? window.location.pathname.match(/\/employees\/([a-zA-Z0-9_-]+)/)?.[1] : undefined;

    try {
      const response = await fetch("/api/enterprise/lana-ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortController.signal,
        body: JSON.stringify({
          message: textToSend,
          conversationId,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          context: {
            selectedEmployeeId: currentSelectedEmployeeId,
            pathname: typeof window !== "undefined" ? window.location.pathname : undefined
          }
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.message || `HTTP ${response.status}`);
      }

      const newConvId = response.headers.get("X-Conversation-Id");
      if (newConvId) setConversationId(newConvId);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n").filter(Boolean);

          for (const line of lines) {
            if (line.startsWith("0:")) {
              try {
                const textChunk = JSON.parse(line.slice(2));
                fullContent += textChunk;
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantMsgId ? { ...m, content: fullContent } : m))
                );
                scrollToBottom("auto");
              } catch {}
            } else if (line.startsWith("e:") || line.startsWith("3:")) {
              // stream stop or error
            }
          }
        }
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMsgId ? { ...m, content: fullContent || "تم تنفيذ الطلب.", isStreaming: false } : m))
      );
    } catch (err: any) {
      if (err.name === "AbortError") {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsgId ? { ...m, content: m.content + " [تم إيقاف التوليد]", isStreaming: false } : m))
        );
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: `عذراً، حدث خطأ أثناء المعالجة: ${err.message}`, isStreaming: false }
              : m
          )
        );
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }

  function getFileIcon(type: string) {
    if (type.includes("pdf") || type.includes("word")) return <FileText className="h-4 w-4 text-rose-500" />;
    if (type.includes("sheet") || type.includes("excel") || type.includes("csv")) return <FileSpreadsheet className="h-4 w-4 text-emerald-500" />;
    return <ImageIcon className="h-4 w-4 text-secondary" />;
  }

  return (
    <div
      className="fixed bottom-5 left-5 z-[80] flex flex-col items-start gap-3"
      dir="rtl"
    >
      {open ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl transition-all duration-300 dark:border-slate-800 dark:bg-slate-950 ${
            isExpanded
              ? "fixed inset-4 sm:inset-10 z-[100] w-auto h-auto max-w-5xl mx-auto"
              : "h-[460px] max-h-[78vh] w-[90vw] sm:w-[380px]"
          } ${isDragging ? "ring-2 ring-secondary bg-secondary/50 dark:bg-secondary/20" : ""}`}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-gradient-to-r from-secondary via-secondary to-purple-700 px-4 py-3.5 text-white dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-2xl bg-white/10 backdrop-blur-md shadow-inner">
                <Sparkles className="h-5 w-5 text-amber-300" />
              </div>
              <div>
                <h3 className="font-bold text-sm leading-tight">Lana</h3>
                <p className="text-[11px] text-secondary/90 flex items-center gap-1.5 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  المساعد الذكي الفوري
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={startNewChat}
                title="محادثة جديدة"
                className="grid h-8 w-8 place-items-center rounded-xl transition hover:bg-white/10 active:scale-95"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? "تصغير" : "توسيع"}
                className="grid h-8 w-8 place-items-center rounded-xl transition hover:bg-white/10 active:scale-95"
              >
                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                title="إغلاق"
                className="grid h-8 w-8 place-items-center rounded-xl transition hover:bg-white/10 active:scale-95"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages Body */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="relative flex-1 overflow-y-auto p-4 space-y-4 text-sm"
          >
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center px-4 py-8">
                <div className="grid h-14 w-14 place-items-center rounded-3xl bg-secondary/8 text-secondary dark:bg-secondary/50 dark:text-secondary/50 mb-4 shadow-sm">
                  <Sparkles className="h-7 w-7" />
                </div>
                <h4 className="font-bold text-base mb-1.5">تحدث مع Lana</h4>
                <p className="text-xs text-muted-foreground max-w-xs mb-6 leading-relaxed">
                  مساعدك الذكي لإدارة شؤون الموظفين، استعلام الإجازات والرواتب، تسجيل الحضور، وتحليل الملفات (PDF / Excel / Word).
                </p>
                <div className="grid w-full gap-2 text-start">
                  {[
                    "كم رصيد إجازاتي السنوية المتاح الآن؟",
                    "سجل لي دخول اليوم من الموبايل",
                    "ما هي سياسة العمل الإضافي في المؤسسة؟",
                    "عرض تفاصيل آخر مسير راتب لي"
                  ].map((sug, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => send(sug)}
                      className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-xs font-medium text-slate-700 transition hover:border-secondary hover:bg-secondary/50 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:border-secondary/50"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-1.5 ${msg.role === "user" ? "items-start" : "items-end"}`}
                >
                  <div
                    className={`group relative max-w-[88%] rounded-3xl px-4 py-3 shadow-sm ${
                      msg.role === "user"
                        ? "bg-secondary text-white rounded-br-none"
                        : "bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-bl-none border border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    {/* Uploaded Files Preview inside User Message */}
                    {msg.files && msg.files.length > 0 && (
                      <div className="mb-2.5 flex flex-wrap gap-2 border-b border-secondary/30 pb-2">
                        {msg.files.map((f, i) => (
                          <div key={i} className="flex items-center gap-1.5 rounded-xl bg-secondary/80 px-2.5 py-1 text-xs">
                            {getFileIcon(f.type)}
                            <span className="max-w-[120px] truncate">{f.name}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {msg.role === "assistant" ? (
                      msg.content ? (
                        <LanaMarkdownRenderer content={msg.content} />
                      ) : (
                        <div className="flex items-center gap-2 py-1 text-secondary dark:text-secondary/50">
                          <span className="flex gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-secondary dark:bg-secondary/50 animate-bounce" />
                            <span className="h-1.5 w-1.5 rounded-full bg-secondary dark:bg-secondary/50 animate-bounce [animation-delay:0.2s]" />
                            <span className="h-1.5 w-1.5 rounded-full bg-secondary dark:bg-secondary/50 animate-bounce [animation-delay:0.4s]" />
                          </span>
                          <span className="text-xs font-semibold">Lana يكتب الآن...</span>
                        </div>
                      )
                    ) : (
                      <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                    )}
                  </div>

                  {/* Actions for Assistant Messages */}
                  {msg.role === "assistant" && msg.content && !msg.isStreaming && (
                    <div className="flex items-center gap-1 px-2 text-xs text-muted-foreground">
                      <button
                        type="button"
                        onClick={() => copyMessage(msg.content, msg.id)}
                        className="flex items-center gap-1 rounded-lg px-2 py-1 transition hover:bg-slate-100 dark:hover:bg-slate-900"
                        title="نسخ الرد"
                      >
                        {copiedMsgId === msg.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedMsgId === msg.id ? "تم النسخ" : "نسخ"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const userMsgs = messages.filter((m) => m.role === "user");
                          const lastUserMsg = userMsgs[userMsgs.length - 1]?.content;
                          if (lastUserMsg) send(lastUserMsg);
                        }}
                        className="flex items-center gap-1 rounded-lg px-2 py-1 transition hover:bg-slate-100 dark:hover:bg-slate-900"
                        title="إعادة توليد الرد"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>إعادة توليد</span>
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Floating Scroll to Bottom Button */}
          {showScrollBottom && (
            <button
              type="button"
              onClick={() => scrollToBottom("smooth")}
              className="absolute bottom-20 start-1/2 -translate-x-1/2 z-10 grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900 text-slate-700 dark:text-slate-300 transition hover:scale-105 active:scale-95"
            >
              <ArrowDown className="h-4 w-4" />
            </button>
          )}

          {/* Staged File Pills before Sending */}
          {files.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-slate-50/80 px-4 py-2 dark:border-slate-800 dark:bg-slate-900/50">
              {files.map((f, idx) => (
                <div key={idx} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  {getFileIcon(f.type)}
                  <span className="max-w-[140px] truncate font-medium">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                    className="ms-1 text-slate-400 hover:text-rose-500"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input Area */}
          <div className="shrink-0 border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5 focus-within:border-secondary focus-within:ring-2 focus-within:ring-secondary/20 dark:border-slate-800 dark:bg-slate-900/50">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,image/*"
                onChange={(e) => handleFileUpload(e.target.files)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="إرفاق ملف (PDF / Excel / Word / صور)"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-200/60 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <Paperclip className="h-4 w-4" />
              </button>

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="اسأل Lana أي شيء أو اطلب تنفيذ عملية في النظام..."
                rows={1}
                className="max-h-32 min-h-[36px] w-full resize-none border-0 bg-transparent py-2 text-sm focus:outline-none focus:ring-0 placeholder:text-muted-foreground"
              />

              {isStreaming ? (
                <button
                  type="button"
                  onClick={stopGenerating}
                  title="إيقاف التوليد"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose-600 text-white shadow-md transition hover:bg-rose-700 active:scale-95"
                >
                  <Square className="h-4 w-4 fill-white" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => send()}
                  disabled={(!input.trim() && files.length === 0) || isStreaming}
                  title="إرسال"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary text-white shadow-md transition hover:bg-secondary disabled:opacity-40 disabled:pointer-events-none active:scale-95"
                >
                  <Send className="h-4 w-4 -rotate-90" />
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="مساعد Lana AI"
          className="group relative flex items-center gap-2.5 rounded-3xl bg-gradient-to-r from-secondary via-secondary to-purple-700 px-4 py-3 text-white shadow-xl shadow-secondary/30 transition-all duration-300 hover:scale-105 hover:shadow-2xl active:scale-95"
        >
          <div className="relative grid h-8 w-8 place-items-center rounded-2xl bg-white/20 backdrop-blur-md">
            <Sparkles className="h-4 w-4 text-amber-300" />
            <span className="absolute -top-1 -end-1 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-secondary animate-pulse" />
          </div>
          <span className="font-bold text-sm tracking-wide">Lana</span>
        </button>
      )}
    </div>
  );
}
