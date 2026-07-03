import type { ReactNode } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

export function AuthCard({
  title,
  description,
  children,
  footer
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="grid min-h-screen bg-[radial-gradient(circle_at_20%_20%,#2563eb22,transparent_30rem),linear-gradient(135deg,hsl(var(--background)),hsl(var(--muted)))] lg:grid-cols-[1fr_520px]">
      <section className="hidden flex-col justify-between p-10 text-white lg:flex bg-[linear-gradient(135deg,#020617,#1d4ed8_55%,#059669)]">
        <Link href="/" className="flex items-center gap-3 text-lg font-semibold">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15"><ShieldCheck className="h-5 w-5" /></span>
          Lana HRMS
        </Link>
        <div className="max-w-xl space-y-5">
          <p className="text-sm uppercase tracking-wide text-white/70">Enterprise workforce platform</p>
          <h1 className="text-5xl font-semibold leading-tight">Secure people operations for modern teams.</h1>
          <p className="text-lg text-white/75">RBAC, audit logs, payroll workflows, recruitment, attendance, and employee records in one production-ready workspace.</p>
        </div>
        <p className="text-sm text-white/60">Protected by Auth.js sessions, Prisma validation, and role-based permissions.</p>
      </section>
      <section className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md space-y-6">
          <Link href="/" className="block text-center text-sm font-semibold text-muted-foreground lg:hidden">
            Lana HRMS
          </Link>
          <Card className="border bg-background/95 shadow-2xl backdrop-blur">
            <CardHeader>
              <CardTitle className="text-2xl">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {children}
              {footer ? <div className="text-center text-sm text-muted-foreground">{footer}</div> : null}
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}