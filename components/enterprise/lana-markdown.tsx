"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Check } from "lucide-react";

/** Renders a single fenced code block with a language label and a working
 * copy button -- pulled out of the markdown tree so it can hold its own
 * "copied" state without re-rendering the whole message. */
function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="my-2.5 overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 text-slate-100 dark:border-slate-800 shadow-lg" dir="ltr">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-3.5 py-1.5 text-xs text-slate-400">
        <span className="font-mono lowercase">{language || "code"}</span>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1.5 rounded px-2 py-0.5 text-xs transition hover:bg-slate-800 hover:text-white"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          <span>{copied ? "تم النسخ" : "نسخ الكود"}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs font-mono leading-normal text-emerald-300">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** Double-Validation executive-command preview: when the assistant's reply
 * embeds a `{"doubleValidation": true, ...}` JSON payload, render it as a
 * confirm/cancel card instead of raw JSON text. Kept as a pre-check before
 * handing off to ReactMarkdown, since this is a structured UI affordance,
 * not prose. */
function DoubleValidationPreview({ content, onConfirmAction }: { content: string; onConfirmAction: (cmd: string) => void }) {
  const jsonMatch = content.match(/\{[\s\S]*?"doubleValidation"[\s\S]*?\}/);
  const previewObj = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  if (!previewObj) return null;

  return (
    <div className="space-y-4 my-2 p-5 rounded-3xl border-2 border-amber-400/80 bg-gradient-to-br from-amber-50/90 via-white to-amber-100/50 dark:from-amber-950/60 dark:via-slate-900 dark:to-amber-900/40 text-slate-900 dark:text-slate-100 shadow-xl" dir="rtl">
      <div className="flex items-center justify-between border-b border-amber-300/60 dark:border-amber-800 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-500 text-white font-black text-base shadow-sm">👑</span>
          <div>
            <h4 className="text-base font-black text-amber-950 dark:text-amber-200">{previewObj.previewTitle || "ملخص تنفيذي (Execution Preview) — التثبيت المزدوج"}</h4>
            <p className="text-xs font-bold text-amber-800 dark:text-amber-300 mt-0.5">يتطلب هذا الإجراء مصادقتك المباشرة (Double-Validation) قبل التنفيذ في قاعدة البيانات</p>
          </div>
        </div>
        <span className="px-3 py-1 rounded-xl bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100 text-xs font-black shrink-0">بانتظار الاعتماد</span>
      </div>

      <div className="p-4 rounded-2xl bg-white/90 dark:bg-slate-950/80 border border-amber-200 dark:border-amber-800/80 space-y-3">
        <p className="text-sm font-extrabold leading-relaxed text-slate-800 dark:text-slate-200">{previewObj.previewMessage}</p>
        {previewObj.payload ? (
          <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border text-xs font-semibold">
            {Object.entries(previewObj.payload).map(([k, v]) => (
              <div key={k} className="truncate">
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">{k}:</span>
                <span className="font-black text-primary truncate block mt-0.5">{String(v || "-")}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => onConfirmAction("إلغاء الإجراء وتجاهل التعديل")}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 transition"
        >
          ✖ إلغاء الإجراء
        </button>
        <button
          type="button"
          onClick={() => {
            if (previewObj.actionType === "ESCALATE_WORKFLOW") {
              onConfirmAction(`قم فوراً بتنفيذ دالة confirmAndExecuteEscalation للطلب رقم (${previewObj.payload?.requestId}) وتوجيهه للمسؤول (${previewObj.payload?.targetManagerId}) والآن`);
            } else if (previewObj.actionType === "MODIFY_DB") {
              onConfirmAction(`قم فوراً بتنفيذ دالة confirmAndExecuteModifyDB على جدول (${previewObj.payload?.table}) بالعملية (${previewObj.payload?.operation}) والاستعلام (${previewObj.payload?.query}) والآن`);
            } else {
              onConfirmAction("تأكيد واعتماد الإجراء وتنفيذه فوراً في قاعدة البيانات");
            }
          }}
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 via-primary to-emerald-600 hover:from-amber-700 hover:to-emerald-700 text-white font-black text-xs shadow-md transition"
        >
          ✓ اعتماد وتنفيذ الإجراء في قاعدة البيانات الآن
        </button>
      </div>
    </div>
  );
}

/** Shared Lana AI reply renderer: real GitHub-flavored Markdown (headings,
 * bold/italic, ordered/unordered lists, tables, blockquotes, fenced code
 * with a copy button) instead of raw text with literal "**"/"#" markers.
 * Used by both the floating widget and the full-page Lana AI Pro Max chat
 * so the two never drift into separately-maintained renderers again. */
export function LanaMarkdown({ content, onConfirmAction }: { content: string; onConfirmAction?: (cmd: string) => void }) {
  if (
    onConfirmAction &&
    (content.includes('"doubleValidation": true') || content.includes('"doubleValidation":true') || content.includes("AWAITING_EXECUTIVE_CONFIRMATION"))
  ) {
    try {
      const preview = <DoubleValidationPreview content={content} onConfirmAction={onConfirmAction} />;
      if (preview) return preview;
    } catch {
      // fall through to normal markdown rendering if the JSON was malformed
    }
  }

  return (
    <div className="lana-markdown space-y-2 text-sm leading-relaxed break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-lg font-black mt-3 mb-1.5 first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-black mt-3 mb-1.5 first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-black mt-2.5 mb-1 first:mt-0">{children}</h3>,
          h4: ({ children }) => <h4 className="text-sm font-bold mt-2 mb-1 first:mt-0">{children}</h4>,
          p: ({ children }) => <p className="whitespace-pre-wrap leading-relaxed mt-1.5 first:mt-0">{children}</p>,
          strong: ({ children }) => <strong className="font-black">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="my-1.5 space-y-1 ps-1">{children}</ul>,
          ol: ({ children }) => <ol className="my-1.5 space-y-1 ps-1 list-decimal ms-4">{children}</ol>,
          li: ({ children, ...props }) => {
            const isOrdered = (props as any).ordered;
            if (isOrdered) return <li className="marker:font-bold marker:text-secondary">{children}</li>;
            return (
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />
                <span>{children}</span>
              </li>
            );
          },
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-secondary underline underline-offset-2 hover:text-secondary/80">
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-s-4 border-secondary/40 ps-3 my-2 italic text-slate-600 dark:text-slate-400">{children}</blockquote>
          ),
          hr: () => <hr className="my-3 border-slate-200 dark:border-slate-800" />,
          table: ({ children }) => (
            <div className="my-2.5 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-slate-100 dark:bg-slate-900">{children}</thead>,
          th: ({ children }) => <th className="px-3 py-2 text-start font-black border-b border-slate-200 dark:border-slate-800">{children}</th>,
          td: ({ children }) => <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-900">{children}</td>,
          code: ({ className, children, ...props }: any) => {
            const inline = (props as any).inline;
            const codeText = String(children).replace(/\n$/, "");
            if (inline) {
              return (
                <code className="rounded bg-slate-200/70 px-1.5 py-0.5 font-mono text-[0.85em] dark:bg-slate-800" dir="ltr">
                  {codeText}
                </code>
              );
            }
            const lang = /language-(\w+)/.exec(className || "")?.[1] || "";
            return <CodeBlock language={lang} code={codeText} />;
          },
          pre: ({ children }) => <>{children}</>
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
