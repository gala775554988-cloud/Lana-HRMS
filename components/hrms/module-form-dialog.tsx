"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Wraps a create-record form (ModuleForm) in a dialog triggered by a compact
 * "+" button, instead of a permanently-visible side panel next to the table.
 * Keeps the shared generic-module system (ModuleForm/ModuleTable) untouched --
 * this only changes where the form is mounted.
 */
export function ModuleFormDialog({ triggerLabel, title, description, children }: { triggerLabel: string; title: string; description?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="me-1.5 h-4 w-4" />
        {triggerLabel}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <div>
              <DialogTitle>{title}</DialogTitle>
              {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
            </div>
            <DialogClose onClick={() => setOpen(false)} />
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    </>
  );
}
