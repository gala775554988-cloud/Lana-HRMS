"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type MergedModuleTabItem = {
  value: string;
  label: string;
  icon?: LucideIcon;
  hidden?: boolean;
  content: React.ReactNode;
};

/**
 * Shared top-level tab shell for pages that consolidate several previously
 * separate routes (e.g. /employees, /setup, /approvals). Reads/writes the
 * active tab via the ?tab= query param so old routes can redirect straight
 * into a specific tab and the tab choice survives a refresh/bookmark.
 */
export function MergedModuleTabs({ items, defaultValue }: { items: MergedModuleTabItem[]; defaultValue?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const visible = items.filter((item) => !item.hidden);
  const requested = searchParams.get("tab");
  const active = visible.some((item) => item.value === requested) ? requested! : (defaultValue ?? visible[0]?.value);

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.replace(`?${params.toString()}`, { scroll: false });
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
        <TabsContent key={item.value} value={item.value} className="mt-0 focus-visible:outline-none">
          {item.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
