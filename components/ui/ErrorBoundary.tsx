'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Copy, CheckCircle2 } from 'lucide-react';
import { parseClientError } from '@/lib/errors';
import type { StructuredError } from '@/lib/errors';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
  structuredError?: StructuredError;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, copied: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const structured = parseClientError(error, this.props.componentName || errorInfo.componentStack?.split('\n')[1]?.trim());
    this.setState({ structuredError: structured });
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleCopy = () => {
    const err = this.state.structuredError;
    if (!err) return;
    const text = [
      `رقم المرجع: ${err.id}`,
      `نوع الخطأ: ${err.name}`,
      `التصنيف: ${err.category}`,
      `الرسالة: ${err.message}`,
      err.cause ? `السبب: ${err.cause}` : "",
      err.suggestion ? `الحل: ${err.suggestion}` : "",
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, structuredError: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const err = this.state.structuredError || {
        id: "ERR-UNKNOWN",
        category: "unknown" as const,
        name: "Error",
        message: this.state.error?.message || "حدث خطأ غير متوقع",
        cause: undefined,
        suggestion: "أعد تحميل الصفحة أو حاول مرة أخرى",
      };

      return (
        <div className="flex min-h-[400px] items-center justify-center p-8" dir="rtl">
          <div className="max-w-lg w-full text-center rounded-xl border bg-background p-6 shadow-sm">
            <div className="flex justify-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <AlertTriangle className="h-6 w-6" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">{err.name}</h2>
            <p className="text-sm text-muted-foreground mb-3">{err.message}</p>
            
            {err.cause && (
              <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2 mb-3">
                <strong>السبب:</strong> {err.cause}
              </div>
            )}

            {err.suggestion && (
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3 mb-4">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1">💡 الحل المقترح</p>
                <p className="text-sm text-emerald-800 dark:text-emerald-300">{err.suggestion}</p>
              </div>
            )}

            <p className="text-[10px] text-muted-foreground font-mono mb-4">مرجع: {err.id}</p>

            <div className="flex justify-center gap-2">
              <button onClick={this.handleReset} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition">
                <RefreshCw className="h-3.5 w-3.5 inline ml-1.5" />
                إعادة المحاولة
              </button>
              <a href="/" className="px-4 py-2 border rounded-lg text-sm hover:bg-muted transition inline-flex items-center gap-1.5">
                <Home className="h-3.5 w-3.5" />
                الرئيسية
              </a>
              <button onClick={this.handleCopy} className="px-4 py-2 border rounded-lg text-sm hover:bg-muted transition inline-flex items-center gap-1.5">
                {this.state.copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {this.state.copied ? "تم النسخ" : "نسخ"}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
