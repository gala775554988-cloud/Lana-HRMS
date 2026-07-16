"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { getPermissionHint } from "@/lib/enterprise/permission-hints";

/** Small "?" icon shown next to a permission key; click to reveal what it
 * actually unlocks and what effect toggling it has, so an admin understands
 * the impact before saving. */
export function PermissionHint({ permission }: { permission: string }) {
  const [open, setOpen] = useState(false);
  const hint = getPermissionHint(permission);

  return (
    <span className="relative inline-flex shrink-0">
      <button
        type="button"
        onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOpen((value) => !value); }}
        className="rounded-full text-muted-foreground transition hover:text-foreground"
        aria-label={`شرح صلاحية ${permission}`}
        aria-expanded={open}
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {open ? (
        <span
          role="tooltip"
          onClick={(event) => event.stopPropagation()}
          className="absolute end-0 top-full z-50 mt-1.5 w-60 rounded-lg border bg-popover p-2.5 text-xs leading-5 text-popover-foreground shadow-lg"
        >
          <strong className="mb-0.5 block">{hint.title}</strong>
          <span className="text-muted-foreground">{hint.effect}</span>
        </span>
      ) : null}
    </span>
  );
}
