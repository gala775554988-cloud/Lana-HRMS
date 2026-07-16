import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function EmployeePageLoading() {
  return (
    <div className="space-y-6 animate-pulse" dir="rtl">
      <div className="space-y-2">
        <div className="h-8 w-48 rounded-xl bg-slate-200 dark:bg-slate-800" />
        <div className="h-4 w-72 rounded-lg bg-slate-100 dark:bg-slate-800/60" />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="rounded-3xl border-slate-100 dark:border-slate-800">
            <CardContent className="p-5 space-y-3">
              <div className="h-4 w-20 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-7 w-28 rounded-lg bg-slate-200 dark:bg-slate-800" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-3xl border-slate-100 dark:border-slate-800">
        <CardHeader className="space-y-2">
          <div className="h-6 w-40 rounded-lg bg-slate-200 dark:bg-slate-800" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 w-full rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
