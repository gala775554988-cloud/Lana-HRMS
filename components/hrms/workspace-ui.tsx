import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function WorkspaceHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}

export function MetricStrip({ items, className }: { items: Array<{ label: string; value: ReactNode }>; className?: string }) {
  return (
    <div className={cn("grid overflow-hidden rounded-xl border bg-card sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6", className)}>
      {items.map((item) => (
        <div key={item.label} className="border-b p-4 last:border-b-0 sm:border-e lg:border-b-0">
          <p className="text-xs text-muted-foreground">{item.label}</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

export function CalmEmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 text-center">
      <p className="font-semibold">{title}</p>
      {description ? <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}
