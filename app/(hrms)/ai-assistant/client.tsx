"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  Bot, Send, Sparkles, Plus, Copy, Check, RefreshCw, Square, 
  Paperclip, FileText, Image as ImageIcon, FileSpreadsheet, MessageSquare, Trash2
} from "lucide-react";
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

type ConversationSummary = {
  id: string;
  title: string;
  createdAt: string;
};

function LanaMarkdownRenderer({ content }: { content: string }) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  function copyCode(code: string, idx: number) {
    navigator.clipboard.writeText(code);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {parts.map((part, idx) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const lines = part.slice(3, -3).trim().split("\n");
          const lang = lines[0]?.match(/^[a-zA-Z0-9_-]+$/) ? lines[0] : "";
          const code = lang ? lines.slice(1).join("\n") : lines.join("\n");

          return (
            <div key={idx} className="my-3 overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 text-slate-100 dark:border-slate-800 shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 py-2 text-xs text-slate-400">
                <span className="font-mono lowercase">{lang || "code"}</span>
                <button
                  type="button"
                  onClick={() => copyCode(code, idx)}
                  className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition hover:bg-slate-800 hover:text-white"
                >
                  {copiedIndex === idx ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedIndex === idx ? "تم النسخ" : "نسخ الكود"}</span>
                </button>
              </div>
              <pre className="overflow-x-auto p-4 text-xs font-mono leading-normal text-emerald-300">
                <code>{code}</code>
              </pre>
            </div>
          );
        }

        return (
          <div key={idx} className="whitespace-pre-wrap break-words">
            {part.split("\n").map((line, lIdx) => {
              const trimmed = line.trim();
              if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
                return (
                  <div key={lIdx} className="flex items-start gap-2.5 ms-3 my-1">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                    <span>{trimmed.slice(2)}</span>
                  </div>
                );
              }
              if (/^\d+\.\s/.test(trimmed)) {
                const numMatch = trimmed.match(/^(\d+\.)\s+(.*)/);
                return (
                  <div key={lIdx} className="flex items-start gap-2.5 ms-3 my-1">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 shrink-0">{numMatch?.[1]}</span>
                    <span>{numMatch?.[2] || trimmed}</span>
                  </div>
                );
              }
              return (
                <p key={lIdx} className={lIdx > 0 ? "mt-2" : ""}>
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

export function LanaAiFullPageClient() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [isStreaming, setIsStreaming] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function scrollToBottom(behavior: ScrollBehavior = "smooth") {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }

  useEffect(() => {
    scrollToBottom("auto");
  }, [messages]);

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

  async function handleFileUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const newFiles: UploadedFile[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (file.size > 10 * 1024 * 1024) continue;
      const dataUri = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      newFiles.push({ name: file.name, type: file.type, size: file.size, dataUri });
    }
    setFiles((prev) => [...prev, ...newFiles]);
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
              } catch {}
            }
          }
        }
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMsgId ? { ...m, content: fullContent || "تم تنفيذ الطلب.", isStreaming: false } : m))
      );
    } catch (err: any) {
      if (err.name !== "AbortError") {
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
    return <ImageIcon className="h-4 w-4 text-indigo-500" />;
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-slate-50 dark:bg-slate-950" dir="rtl">
      {/* Sidebar - Conversations History */}
      <div className="hidden lg:flex w-72 flex-col border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-4 space-y-4">
        <button
          type="button"
          onClick={startNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-700 active:scale-98"
        >
          <Plus className="h-5 w-5" />
          <span>محادثة جديدة</span>
        </button>

        <div className="flex-1 overflow-y-auto space-y-2 text-sm">
          <div className="text-xs font-bold text-muted-foreground px-2 pb-1">سجل المحادثات</div>
          <div className="rounded-2xl border border-dashed p-6 text-center text-xs text-muted-foreground">
            المحادثة الحالية نشطة ومربوطة بذاكرة قاعدة البيانات.
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div
        className={`flex flex-1 flex-col overflow-hidden relative ${
          isDragging ? "ring-4 ring-indigo-500 bg-indigo-50/20" : ""
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileUpload(e.dataTransfer.files); }}
      >
        {/* Top bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur-md px-6 py-4 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-md">
              <Sparkles className="h-6 w-6 text-amber-300" />
            </div>
            <div>
              <h2 className="font-black text-lg text-slate-900 dark:text-slate-100">Lana Assistant</h2>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                متصل بالنظام ومستعد لتنفيذ العمليات والإجابة الفورية
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={startNewChat}>
              <Plus className="h-4 w-4 ml-1.5" />
              جلسة جديدة
            </Button>
          </div>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center max-w-xl mx-auto py-12">
              <div className="grid h-20 w-20 place-items-center rounded-3xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 mb-6 shadow-md">
                <Sparkles className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-black mb-2 text-slate-900 dark:text-slate-100">كيف أستطيع مساعدتك اليوم؟</h3>
              <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
                تحدث معي وكأنك تتحدث مع زميل في الموارد البشرية. أستطيع البحث عن الموظفين، الاستعلام عن الأرصدة، تسجيل الحضور، وتحليل الملفات التي ترفقها.
              </p>
              <div className="grid w-full gap-3 sm:grid-cols-2 text-start">
                {[
                  "كيف أقدم إجازة سنوية في النظام؟",
                  "اعرض لي رصيد إجازاتي وتفاصيل استخدامي",
                  "سجل لي دخول اليوم مع الملاحظة",
                  "ما هي الإجراءات المتبعة في حال تأخر الموظف؟"
                ].map((sug, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => send(sug)}
                    className="rounded-2xl border border-slate-200 bg-white p-4 text-xs font-medium text-slate-700 transition hover:border-indigo-500 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-500/50"
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
                className={`flex flex-col gap-2 max-w-3xl ${msg.role === "user" ? "ms-auto items-end" : "me-auto items-start"}`}
              >
                <div
                  className={`rounded-3xl px-5 py-4 shadow-sm ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white rounded-br-none"
                      : "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-bl-none border border-slate-200 dark:border-slate-800"
                  }`}
                >
                  {msg.files && msg.files.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2 border-b border-indigo-500/30 pb-2.5">
                      {msg.files.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-xl bg-indigo-700 px-3 py-1.5 text-xs text-white">
                          {getFileIcon(f.type)}
                          <span className="max-w-[160px] truncate">{f.name}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.role === "assistant" ? (
                    msg.content ? (
                      <LanaMarkdownRenderer content={msg.content} />
                    ) : (
                      <div className="flex items-center gap-2 py-2 text-indigo-600 dark:text-indigo-400">
                        <span className="flex gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-bounce" />
                          <span className="h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-bounce [animation-delay:0.2s]" />
                          <span className="h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-bounce [animation-delay:0.4s]" />
                        </span>
                        <span className="text-xs font-semibold">Lana يكتب الآن...</span>
                      </div>
                    )
                  ) : (
                    <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                  )}
                </div>

                {msg.role === "assistant" && msg.content && !msg.isStreaming && (
                  <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => copyMessage(msg.content, msg.id)}
                      className="flex items-center gap-1.5 rounded-xl px-2.5 py-1 transition hover:bg-slate-200 dark:hover:bg-slate-800"
                    >
                      {copiedMsgId === msg.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedMsgId === msg.id ? "تم النسخ" : "نسخ النص"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const userMsgs = messages.filter((m) => m.role === "user");
                        const lastUserMsg = userMsgs[userMsgs.length - 1]?.content;
                        if (lastUserMsg) send(lastUserMsg);
                      }}
                      className="flex items-center gap-1.5 rounded-xl px-2.5 py-1 transition hover:bg-slate-200 dark:hover:bg-slate-800"
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

        {/* Staged files */}
        {files.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-slate-100 px-6 py-2.5 dark:border-slate-800 dark:bg-slate-900">
            {files.map((f, idx) => (
              <div key={idx} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-sm dark:border-slate-800 dark:bg-slate-950">
                {getFileIcon(f.type)}
                <span className="max-w-[180px] truncate font-medium">{f.name}</span>
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                  className="ms-1 text-slate-400 hover:text-rose-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input area */}
        <div className="shrink-0 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="max-w-4xl mx-auto flex items-end gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-2 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-950">
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
              title="إرفاق ملف (PDF, Excel, Word, صور)"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-slate-500 transition hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <Paperclip className="h-5 w-5" />
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
              placeholder="تحدث مع Lana بشكل طبيعي أو اطلب تنفيذ عملية في النظام..."
              rows={1}
              className="max-h-36 min-h-[40px] w-full resize-none border-0 bg-transparent py-2.5 text-sm focus:outline-none focus:ring-0 placeholder:text-muted-foreground"
            />

            {isStreaming ? (
              <button
                type="button"
                onClick={stopGenerating}
                title="إيقاف التوليد"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-rose-600 text-white shadow-md transition hover:bg-rose-700 active:scale-95"
              >
                <Square className="h-4 w-4 fill-white" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => send()}
                disabled={(!input.trim() && files.length === 0) || isStreaming}
                title="إرسال"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-indigo-600 text-white shadow-md transition hover:bg-indigo-700 disabled:opacity-40 disabled:pointer-events-none active:scale-95"
              >
                <Send className="h-5 w-5 -rotate-90" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
