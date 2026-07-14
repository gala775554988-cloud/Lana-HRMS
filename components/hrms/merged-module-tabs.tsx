"use client";

import { Suspense, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type MergedModuleTabItem = {
  value: string;
  label: string;
  icon?: LucideIcon;
  hidden?: boolean;
  /**
   * Server-rendered content for this tab. Callers compute this server-side
   * keyed off the same ?tab= query param this component reads/writes, and
   * pass `null` for every tab that isn't currently active -- that's what
   * keeps switching tabs from fetching/rendering every tab's data on every
   * page load (an async Server Component used as tab content still executes
   * during the server render regardless of client-side "active tab" state,
   * since that state doesn't exist yet on the server).
   */
  content: React.ReactNode;
};

function MergedModuleTabsInner({ items, defaultValue }: { items: MergedModuleTabItem[]; defaultValue?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const visible = items.filter((item) => !item.hidden);
  const requested = searchParams.get("tab");
  const active = visible.some((item) => item.value === requested) ? requested! : (defaultValue ?? visible[0]?.value);

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    startTransition(() => {
      router.replace(`?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <Tabs value={active} onValueChange={onChange} className="space-y-5">
      <TabsList className="h-auto flex-wrap justify-start gap-1.5 rounded-xl bg-muted/60 p-1.5">
        {visible.map((item) => (
          <TabsTrigger
            key={item.value}
            value={item.value}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium",
              "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
            )}
          >
            {item.icon ? <item.icon className="h-4 w-4" /> : null}
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {visible.map((item) => (
        <TabsContent key={item.value} value={item.value} className="relative mt-0 focus-visible:outline-none">
          {item.value === active && isPending ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/60 backdrop-blur-sm">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : null}
          {item.content ?? (
            <div className="flex min-h-[30vh] items-center justify-center rounded-xl border bg-card p-8 text-muted-foreground">
              <Loader2 className="me-2 h-4 w-4 animate-spin" /> جاري التحميل...
            </div>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}

export function MergedModuleTabs(props: { items: MergedModuleTabItem[]; defaultValue?: string }) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted/40" />}>
      <MergedModuleTabsInner {...props} />
    </Suspense>
  );
}
