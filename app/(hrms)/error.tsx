"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HrmsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-lg rounded-lg border bg-background p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-semibold">Something needs attention</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message || "The HRMS workspace could not load this view."}</p>
        <Button className="mt-6" onClick={reset}>Try again</Button>
      </div>
    </section>
  );
}