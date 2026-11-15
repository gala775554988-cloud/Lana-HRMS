"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  panelClassName?: string;
  overlayClassName?: string;
  portal?: boolean;
  ariaLabel?: string;
}

export function Dialog({ open, onOpenChange, children, panelClassName, overlayClassName, portal = false, ariaLabel }: DialogProps) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onOpenChange(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  if (!open || (portal && !mounted)) return null;

  const content = (
    <div className={cn("fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 animate-fade-in", overlayClassName)} onClick={() => onOpenChange(false)} role="dialog" aria-modal="true" aria-label={ariaLabel}>
      <div onClick={(e) => e.stopPropagation()} className={cn("relative max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl border border-border bg-card shadow-2xl", panelClassName)}>
        {children}
      </div>
    </div>
  );
  return portal ? createPortal(content, document.body) : content;
}

export function DialogContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6", className)} {...props}>{children}</div>;
}

export function DialogHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 flex items-center justify-between", className)} {...props}>{children}</div>;
}

export function DialogTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-xl font-semibold", className)} {...props}>{children}</h2>;
}

export function DialogDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props}>{children}</p>;
}

export function DialogClose({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors" aria-label="Close">
      <X className="h-4 w-4" />
    </button>
  );
}
