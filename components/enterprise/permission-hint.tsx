"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { getPermissionHint } from "@/lib/enterprise/permission-hints";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/** Small "?" icon shown next to a permission key; click/hover to reveal what it
 * actually unlocks and what effect toggling it has, so an admin understands
 * the impact before saving. */
export function PermissionHint({ permission }: { permission: string }) {
  const [open, setOpen] = useState(false);
  const hint = getPermissionHint(permission);

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOpen((value) => !value); }}
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-slate-100 hover:text-foreground dark:hover:bg-slate-800"
            aria-label={`شرح صلاحية ${permission}`}
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="start"
          sideOffset={8}
          collisionPadding={16}
          onClick={(event) => event.stopPropagation()}
          className="z-[9999] w-64 p-3 shadow-2xl"
        >
          <strong className="mb-1 block font-bold text-slate-100 dark:text-slate-100">{hint.title}</strong>
          <span className="block text-slate-300 dark:text-slate-300 leading-relaxed">{hint.effect}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
